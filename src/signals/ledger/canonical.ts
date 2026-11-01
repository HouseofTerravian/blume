// Canonical row hash for thq_retrieval_events (doctrine section 7). The database recomputes and verifies this on every
// insert, so a mismatch fails loudly instead of silently.
//
// sha256 (hex) of the UTF-8 string made by joining the 30 fields below, in this order, with the unit separator 0x1f.
// NULL/absent is the empty string, booleans are true/false, arrays are comma-joined (already sorted and unique),
// occurred_at is the UTC millisecond string. recorded_at, txid and row_hash are not part of it.

import { createHash } from "crypto";
import type { LedgerEvent } from "./types.js";

export const CANONICAL_FIELDS = [
  "event_id", "retrieval_id", "seq", "phase", "event_type", "schema_version",
  "provider", "engine", "query_policy", "sanitize_policy", "param_names", "query_length",
  "has_location", "data_type", "num_requested", "save_requested", "rejected_field", "reason_codes",
  "error_code", "stage", "result_count", "served_from_cache", "artifact_uuid", "artifact_hash",
  "retention_ref", "retention_scope", "affected_rows", "writer_id", "app_version", "occurred_at",
] as const;

function render(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

export function canonicalString(event: Omit<LedgerEvent, "row_hash">): string {
  const record = event as unknown as Record<string, unknown>;
  return CANONICAL_FIELDS.map(field => render(record[field])).join("\x1f");
}

export function rowHash(event: Omit<LedgerEvent, "row_hash">): string {
  return createHash("sha256").update(canonicalString(event), "utf8").digest("hex");
}
