// TPIG raw signal envelope — immutable, sanitized archive of a provider response, House-level.
// Stage 1 (Retrieval) only: no normalization, scoring, or routing.
//
// The archived response is NOT byte-for-byte provider data. It is the parsed JSON with the
// transformations of SANITIZATION_POLICY applied (see policy.ts and
// docs/doctrine/tpig-query-and-pii-policy.md); the artifact hash covers that exact archived
// representation, and the pre-sanitization hash is recorded for comparison.

import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { config } from "../config.js";
import { ingestArtifact, RAW_SIGNAL_KIND } from "../artifacts/store.js";
import {
  SANITIZATION_POLICY,
  SanitizationFailure,
  isClean,
  redactText,
  sanitizeStructure,
  sanitizeString,
} from "./policy.js";

export { SANITIZATION_POLICY };
export const ENVELOPE_SCHEMA_VERSION = "tpig-raw-1";
export const HOUSE_SCOPE = "house";
export const MAX_RESULTS = 20;

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

/** SerpAPI reports "2026-10-31 04:19:15 UTC"; may be earlier than retrieved_at when served from its cache. */
function providerObservedAt(response: unknown): string | null {
  const created = (response as { search_metadata?: { created_at?: string } } | null)?.search_metadata?.created_at;
  if (!created) return null;
  const d = new Date(created.replace(" UTC", "Z").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Retrieval log (append-only events) ──────────────────────────────────────

/**
 * Every event is redacted and verified before it is written. If an event cannot be verified clean it is
 * replaced by a content-free suppression marker; unverified text is never written.
 */
export function logSignalEvent(event: Record<string, unknown>): void {
  try {
    const dir = path.join(config.vault.root, "_signals");
    fs.mkdirSync(dir, { recursive: true });
    let line: string;
    try {
      const clean = sanitizeStructure({ at: new Date().toISOString(), ...event }, "log-event");
      line = JSON.stringify(clean.value);
    } catch {
      line = JSON.stringify({ at: new Date().toISOString(), event: "log_suppressed", reason: "sanitization_unverified" });
    }
    fs.appendFileSync(path.join(dir, "retrieval-log.jsonl"), line + "\n", "utf-8");
  } catch (err) {
    console.error("[signals] retrieval log write failed:", err instanceof Error ? redactText(err.message).text : "unknown");
  }
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function saveRawSignal(input: RawSignalInput): Promise<{ uuid: string; hash: string }> {
  const params = sanitizeStructure(withoutKey(input.params), "params", ["params"]);
  const response = sanitizeStructure(input.response, "response", ["response"]);
  const observedAt = providerObservedAt(input.response);

  const title = sanitizeString(
    `${input.provider}/${input.engine}: ${String((params.value as Record<string, unknown>).q ?? (params.value as Record<string, unknown>).search_query ?? "")}`.slice(0, 200),
    "title",
  );

  const body = JSON.stringify(
    {
      schema_version: ENVELOPE_SCHEMA_VERSION,
      provider: input.provider,
      engine: input.engine,
      retrieval_method: "api",
      retrieved_at: input.retrievedAt,
      observed_at: observedAt,
      observed_at_source: observedAt ? "provider" : null,
      params: params.value,
      sanitization: {
        policy: SANITIZATION_POLICY,
        redacted_paths: [...params.redactedPaths, ...response.redactedPaths],
        pre_sanitization_sha256: createHash("sha256").update(JSON.stringify(input.response)).digest("hex"),
        pre_sanitization_note: "sha256 of the parsed provider JSON re-serialized, not of the wire bytes",
      },
      response: response.value,
    },
    null,
    2,
  );
  // Final gate over exactly what will be stored. A failure here stores nothing.
  if (!isClean(body)) throw new SanitizationFailure("archive-body");

  const { artifact } = await ingestArtifact(
    {
      brand: HOUSE_SCOPE,
      vault: "rnd",
      source: "imported",
      title,
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

/** A caller-safe failure message: never contains provider text, params or secrets. */
function safeSaveError(err: unknown): string {
  if (err instanceof SanitizationFailure) return err.message;
  const text = err instanceof Error ? err.message : "";
  const r = redactText(text);
  return r.count === 0 && isClean(text) && text.length <= 200 ? text : "archive failed (details withheld by policy)";
}

/**
 * Log the retrieval FIRST, then optionally archive it. A failed archive never discards the retrieval record.
 * `sanitization_failed` tells the caller that redaction could not be verified, so the response must be
 * withheld as well: a failed sanitization never makes the unsanitized response safe to return.
 */
export async function recordRetrieval(
  input: RawSignalInput & { save: boolean },
): Promise<{
  retrieval_id: string;
  saved: { uuid: string; hash: string } | null;
  save_error: string | null;
  sanitization_failed: boolean;
}> {
  const retrievalId = randomUUID();
  const base = {
    retrieval_id: retrievalId,
    provider: input.provider,
    engine: input.engine,
    params: withoutKey(input.params),
  };
  logSignalEvent({ event: "retrieved", ...base, retrieved_at: input.retrievedAt, save_requested: input.save });
  if (!input.save) return { retrieval_id: retrievalId, saved: null, save_error: null, sanitization_failed: false };

  try {
    const saved = await saveRawSignal(input);
    logSignalEvent({ event: "save_ok", retrieval_id: retrievalId, saved_uuid: saved.uuid, hash: saved.hash });
    return { retrieval_id: retrievalId, saved, save_error: null, sanitization_failed: false };
  } catch (err) {
    const message = safeSaveError(err);
    const failed = err instanceof SanitizationFailure;
    logSignalEvent({ event: failed ? "sanitization_failed" : "save_failed", retrieval_id: retrievalId, error: message });
    return { retrieval_id: retrievalId, saved: null, save_error: message, sanitization_failed: failed };
  }
}
