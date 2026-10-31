// TPIG raw signal envelope — immutable, sanitized archive of a provider response, House-level.
// Stage 1 (Retrieval) only: no normalization, scoring, or routing.
//
// The archived response is NOT byte-for-byte provider data. It is the parsed JSON with the
// transformations named in SANITIZATION_POLICY applied; the artifact hash covers that exact
// archived representation, and the pre-sanitization hash is recorded for comparison.

import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { config } from "../config.js";
import { ingestArtifact, RAW_SIGNAL_KIND } from "../artifacts/store.js";

export const ENVELOPE_SCHEMA_VERSION = "tpig-raw-1";
export const SANITIZATION_POLICY = "tpig-sanitize-1";
export const HOUSE_SCOPE = "house";
export const MAX_RESULTS = 20;

const CAPABILITY_URL = /^https:\/\/serpapi\.com\/searches\//;
const REDACTED_URL = "[REDACTED:provider-capability-url]";

export interface RawSignalInput {
  provider: string;
  engine: string;
  params: Record<string, unknown>;
  response: unknown;
  retrievedAt: string;
}

function withoutKey(params: Record<string, unknown>): Record<string, unknown> {
  const { api_key: _omit, ...rest } = params;
  return rest;
}

function scrub(text: string): string {
  return config.serpapi.apiKey ? text.split(config.serpapi.apiKey).join("[REDACTED:credential]") : text;
}

/** tpig-sanitize-1: redact provider capability URLs (tokenized links to the provider's cached copy). */
function sanitize(value: unknown, pathParts: string[], redacted: string[]): unknown {
  if (typeof value === "string") {
    if (CAPABILITY_URL.test(value)) {
      redacted.push(pathParts.join("."));
      return REDACTED_URL;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => sanitize(v, [...pathParts, String(i)], redacted));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitize(v, [...pathParts, k], redacted)]),
    );
  }
  return value;
}

/** SerpAPI reports "2026-10-31 04:19:15 UTC"; may be earlier than retrieved_at when served from its cache. */
function providerObservedAt(response: unknown): string | null {
  const created = (response as { search_metadata?: { created_at?: string } } | null)?.search_metadata?.created_at;
  if (!created) return null;
  const d = new Date(created.replace(" UTC", "Z").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Retrieval log (append-only events) ──────────────────────────────────────

export function logSignalEvent(event: Record<string, unknown>): void {
  try {
    const dir = path.join(config.vault.root, "_signals");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, "retrieval-log.jsonl"),
      scrub(JSON.stringify({ at: new Date().toISOString(), ...event })) + "\n",
      "utf-8",
    );
  } catch (err) {
    console.error("[signals] retrieval log write failed:", err instanceof Error ? err.message : err);
  }
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function saveRawSignal(input: RawSignalInput): Promise<{ uuid: string; hash: string }> {
  const params = withoutKey(input.params);
  const redacted: string[] = [];
  const response = sanitize(input.response, ["response"], redacted);
  const observedAt = providerObservedAt(input.response);

  const body = scrub(
    JSON.stringify(
      {
        schema_version: ENVELOPE_SCHEMA_VERSION,
        provider: input.provider,
        engine: input.engine,
        retrieval_method: "api",
        retrieved_at: input.retrievedAt,
        observed_at: observedAt,
        observed_at_source: observedAt ? "provider" : null,
        params,
        sanitization: {
          policy: SANITIZATION_POLICY,
          redacted_paths: redacted,
          pre_sanitization_sha256: createHash("sha256").update(JSON.stringify(input.response)).digest("hex"),
          pre_sanitization_note: "sha256 of the parsed provider JSON re-serialized, not of the wire bytes",
        },
        response,
      },
      null,
      2,
    ),
  );

  const { artifact } = await ingestArtifact(
    {
      brand: HOUSE_SCOPE,
      vault: "rnd",
      source: "imported",
      title: `${input.provider}/${input.engine}: ${String(params.q ?? params.search_query ?? "")}`.slice(0, 200),
      body,
      metadata: {
        kind: RAW_SIGNAL_KIND,
        scope: "institutional",
        schema_version: ENVELOPE_SCHEMA_VERSION,
        sanitization_policy: SANITIZATION_POLICY,
        provider: input.provider,
        engine: input.engine,
        retrieved_at: input.retrievedAt,
        observed_at: observedAt,
      },
    },
    { institutional: true },
  );
  return { uuid: artifact.uuid, hash: artifact.hash };
}

/**
 * Log the retrieval FIRST, then optionally archive it. A failed archive never discards a paid
 * response: the caller gets the results plus `save_error`, and the failure is logged.
 */
export async function recordRetrieval(
  input: RawSignalInput & { save: boolean },
): Promise<{ retrieval_id: string; saved: { uuid: string; hash: string } | null; save_error: string | null }> {
  const retrievalId = randomUUID();
  const base = {
    retrieval_id: retrievalId,
    provider: input.provider,
    engine: input.engine,
    params: withoutKey(input.params),
  };
  logSignalEvent({ event: "retrieved", ...base, retrieved_at: input.retrievedAt, save_requested: input.save });
  if (!input.save) return { retrieval_id: retrievalId, saved: null, save_error: null };

  try {
    const saved = await saveRawSignal(input);
    logSignalEvent({ event: "save_ok", retrieval_id: retrievalId, saved_uuid: saved.uuid, hash: saved.hash });
    return { retrieval_id: retrievalId, saved, save_error: null };
  } catch (err) {
    const message = scrub(err instanceof Error ? err.message : String(err));
    logSignalEvent({ event: "save_failed", retrieval_id: retrievalId, error: message });
    return { retrieval_id: retrievalId, saved: null, save_error: message };
  }
}
