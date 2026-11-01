// TPIG retrieval ledger writer: closed vocabularies and shared types.
// These mirror the allowlists of the DEPLOYED thq_retrieval_events migration (20261031221514). Anything not listed here
// is not writable. retention_exception is intentionally absent: the writer never builds it and the database refuses it.

export const LEDGER_SCHEMA_VERSION = "tpig-ledger-1" as const;

export const EVENT_TYPES = [
  "query_rejected",
  "provider_attempt",
  "provider_succeeded",
  "provider_failed",
  "archive_succeeded",
  "archive_failed",
  "sanitization_failed",
  "output_withheld",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type Phase = "screening" | "provider" | "archive" | "sanitization" | "output";

export const PHASE_OF: Readonly<Record<EventType, Phase>> = {
  query_rejected: "screening",
  provider_attempt: "provider",
  provider_succeeded: "provider",
  provider_failed: "provider",
  archive_succeeded: "archive",
  archive_failed: "archive",
  sanitization_failed: "sanitization",
  output_withheld: "output",
};

export const PROVIDERS = ["serpapi"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const ENGINES = ["google", "google_events", "google_maps", "youtube", "google_news", "google_trends"] as const;
export type Engine = (typeof ENGINES)[number];

/** Names only, sorted by C collation (plain code-unit order for ASCII). Never values. */
export const PARAM_NAMES = ["data_type", "date", "geo", "location", "num", "q", "search_query"] as const;
export type ParamName = (typeof PARAM_NAMES)[number];

export const DATA_TYPES = ["TIMESERIES", "GEO_MAP", "RELATED_QUERIES", "RELATED_TOPICS"] as const;
export type DataType = (typeof DATA_TYPES)[number];

export const REJECTED_FIELDS = ["q", "location", "geo", "date", "engine", "data_type", "num"] as const;
export type RejectedField = (typeof REJECTED_FIELDS)[number];

export const REASON_CODES = [
  "invalid_type", "empty", "too_long", "control_characters", "invalid_format", "email", "phone", "national_id",
  "payment_card", "iban", "street_address", "credential", "tokenized_url",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const STAGES = ["params", "response", "title", "archive-body", "output", "log-event"] as const;
export type Stage = (typeof STAGES)[number];

export const ARCHIVE_ERROR_CODES = ["archive_write", "archive_mirror", "archive_unknown"] as const;
export type ArchiveErrorCode = (typeof ARCHIVE_ERROR_CODES)[number];

/** `http_NNN` for a 100-599 status, otherwise one of the closed words. No free text, ever. */
export type ProviderErrorCode = `http_${number}` | "timeout" | "network" | "provider_error";
export type LedgerErrorCode = ProviderErrorCode | ArchiveErrorCode | "sanitization_unverified";

/** The JSON object sent to thq_append_retrieval_event(p). recorded_at and txid are server-owned and never sent. */
export interface LedgerEvent {
  event_id: string;
  retrieval_id: string;
  seq: number;
  phase: Phase;
  event_type: EventType;
  schema_version: typeof LEDGER_SCHEMA_VERSION;
  provider?: Provider;
  engine?: Engine;
  query_policy?: string;
  sanitize_policy?: string;
  param_names?: string[];
  query_length?: number;
  has_location?: boolean;
  data_type?: DataType;
  num_requested?: number;
  save_requested?: boolean;
  rejected_field?: RejectedField;
  reason_codes?: ReasonCode[];
  error_code?: string;
  stage?: Stage;
  result_count?: number;
  served_from_cache?: boolean;
  artifact_uuid?: string;
  artifact_hash?: string;
  writer_id: string;
  app_version: string;
  occurred_at: string;
  row_hash: string;
}

/**
 * Why a write did not complete. Only closed words; derived from the HTTP status and the SQLSTATE code, never from a
 * database message, detail or hint (those can echo values).
 */
export type FailureClass =
  | "conflict"          // 23000: same event_id, different payload
  | "seq_conflict"      // 23505: (retrieval_id, seq) already used by another event
  | "validation"        // 23514: allowlist violation (builder bug or schema drift; includes a rejected occurred_at)
  | "permission"        // 42501
  | "auth"              // 401 / 403 / missing credentials
  | "function_missing"  // PGRST202 / 42883
  | "protocol"          // a successful call returned something other than inserted | duplicate
  | "network"
  | "timeout"
  | "server"            // 5xx
  | "rate_limited"      // 429
  | "unknown";

/** Never retried: retrying cannot help and would hide a defect. */
export const HARD_FAILURES: ReadonlySet<FailureClass> = new Set<FailureClass>([
  "conflict", "seq_conflict", "validation", "permission", "auth", "function_missing", "protocol",
]);

export type AppendResult =
  | { ok: true; status: "inserted" | "duplicate" }
  | { ok: false; cls: FailureClass };

export interface AppendOptions {
  timeoutMs: number;
}

/** The only thing the writer needs from the database. The real one calls the deployed RPC; tests use fakes. */
export interface LedgerClient {
  append(event: Readonly<LedgerEvent>, opts: AppendOptions): Promise<AppendResult>;
}
