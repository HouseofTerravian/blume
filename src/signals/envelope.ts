// TPIG raw signal envelope — immutable capture of a provider response, House-level (no brand).
// Stage 1 (Retrieval) only: no normalization, scoring, or routing.

import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { ingestArtifact } from "../artifacts/store.js";

export const ENVELOPE_SCHEMA_VERSION = "tpig-raw-0";
export const HOUSE_SCOPE = "house";
export const MAX_RESULTS = 20;

export interface RawSignalInput {
  provider: string;
  engine: string;
  params: Record<string, unknown>;
  response: unknown;
  retrievedAt: string;
}

function scrub(text: string): string {
  return config.serpapi.apiKey ? text.split(config.serpapi.apiKey).join("[REDACTED]") : text;
}

function logRetrieval(entry: Record<string, unknown>): void {
  const dir = path.join(config.vault.root, "_signals");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "retrieval-log.jsonl"), JSON.stringify(entry) + "\n", "utf-8");
}

/** Log every retrieval (saved or not) so provider usage is auditable. */
export function logSignalRetrieval(
  input: Pick<RawSignalInput, "provider" | "engine" | "params" | "retrievedAt">,
  saved: { uuid: string; hash: string } | null,
): void {
  const { api_key: _omit, ...params } = input.params;
  logRetrieval({
    retrieved_at: input.retrievedAt,
    provider: input.provider,
    engine: input.engine,
    params,
    saved_uuid: saved?.uuid ?? null,
  });
}

/** Persist the untouched provider response to the `rnd` vault as a House-level artifact. */
export async function saveRawSignal(input: RawSignalInput): Promise<{ uuid: string; hash: string }> {
  const { api_key: _omit, ...params } = input.params;
  const body = scrub(
    JSON.stringify(
      {
        schema_version: ENVELOPE_SCHEMA_VERSION,
        provider: input.provider,
        engine: input.engine,
        retrieval_method: "api",
        retrieved_at: input.retrievedAt,
        params,
        response: input.response,
      },
      null,
      2,
    ),
  );
  const { artifact } = await ingestArtifact({
    brand: HOUSE_SCOPE,
    vault: "rnd",
    source: "imported",
    title: `${input.provider}/${input.engine}: ${String(params.q ?? params.search_query ?? "")}`.slice(0, 200),
    body,
    metadata: {
      kind: "tpig.raw_signal",
      schema_version: ENVELOPE_SCHEMA_VERSION,
      provider: input.provider,
      engine: input.engine,
      retrieved_at: input.retrievedAt,
    },
  });
  return { uuid: artifact.uuid, hash: artifact.hash };
}
