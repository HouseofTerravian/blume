// Typed builders for ledger events. An event is assembled ONLY from closed facts (enums, counts, lengths, ids, policy
// versions). There is deliberately no parameter that can carry query text, location text, a URL, a provider payload or an
// error message, so none of them can reach the ledger.
//
// Every builder validates the finished event against a local copy of the deployed database's allowlists and per-type
// field matrix, computes the canonical row_hash, and returns a DEEP-FROZEN object. A frozen event is what makes retries
// identical: the same event_id, occurred_at and row_hash on every attempt.

import { rowHash } from "./canonical.js";
import {
  ARCHIVE_ERROR_CODES, DATA_TYPES, ENGINES, EVENT_TYPES, LEDGER_SCHEMA_VERSION, PARAM_NAMES, PHASE_OF, PROVIDERS,
  REASON_CODES, REJECTED_FIELDS, STAGES,
  type ArchiveErrorCode, type DataType, type Engine, type EventType, type LedgerEvent, type ReasonCode,
  type RejectedField, type Stage,
} from "./types.js";

/** Raised for a malformed event (a programming error or schema drift). The message names a field, never a value. */
export class LedgerBuildError extends Error {
  constructor(public readonly field: string) {
    super(`ledger event invalid: field "${field}"`);
    this.name = "LedgerBuildError";
  }
}

export interface EventContext {
  retrievalId: string;
  writerId: string;
  appVersion: string;
  /** Consumes and returns the next seq of this retrieval. Called exactly once per event built. */
  nextSeq(): number;
  now(): Date;
  uuid(): string;
}

// ─── Local copy of the deployed allowlists ───────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WRITER_ID = /^[a-z0-9_-]{1,40}$/;
const APP_VERSION = /^[0-9A-Za-z._+-]{1,40}$/;
const HEX_RUN_32 = /[0-9A-Fa-f]{32}/;
const QUERY_POLICY = /^tpig-query-policy-[0-9]{1,3}$/;
const SANITIZE_POLICY = /^tpig-sanitize-[0-9]{1,3}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ERROR_CODE = /^(http_[1-5][0-9][0-9]|timeout|network|provider_error|archive_write|archive_mirror|archive_unknown|sanitization_unverified)$/;
const HASH_64 = /^[0-9a-f]{64}$/;
const EARLIEST = Date.parse("2026-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Required and permitted type-specific fields per event type; every other type-specific field must be absent. */
const MATRIX: Readonly<Record<EventType, { req: readonly string[]; opt: readonly string[] }>> = {
  query_rejected:      { req: ["provider", "query_policy", "rejected_field", "reason_codes"], opt: ["engine"] },
  provider_attempt:    { req: ["provider", "engine", "query_policy", "param_names", "query_length", "has_location", "save_requested"], opt: ["data_type", "num_requested"] },
  provider_succeeded:  { req: ["provider", "engine", "result_count"], opt: ["served_from_cache"] },
  provider_failed:     { req: ["provider", "engine", "error_code"], opt: [] },
  archive_succeeded:   { req: ["artifact_uuid", "artifact_hash", "sanitize_policy"], opt: ["provider", "engine"] },
  archive_failed:      { req: ["error_code", "sanitize_policy"], opt: ["provider", "engine"] },
  sanitization_failed: { req: ["stage", "sanitize_policy"], opt: ["provider", "engine"] },
  output_withheld:     { req: ["sanitize_policy"], opt: ["provider", "engine", "stage"] },
};

const TYPE_SPECIFIC = [
  "provider", "engine", "query_policy", "sanitize_policy", "param_names", "query_length", "has_location", "data_type",
  "num_requested", "save_requested", "rejected_field", "reason_codes", "error_code", "stage", "result_count",
  "served_from_cache", "artifact_uuid", "artifact_hash",
] as const;

const bad = (field: string): never => { throw new LedgerBuildError(field); };
const isInt = (v: unknown, lo: number, hi: number): boolean => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const oneOf = (v: unknown, list: readonly string[]): boolean => typeof v === "string" && list.includes(v);

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

function check(type: EventType, e: Record<string, unknown>, now: Date): void {
  // core
  if (typeof e.event_id !== "string" || !UUID.test(e.event_id)) bad("event_id");
  if (typeof e.retrieval_id !== "string" || !UUID.test(e.retrieval_id)) bad("retrieval_id");
  if (!isInt(e.seq, 1, 1000)) bad("seq");
  if (typeof e.writer_id !== "string" || !WRITER_ID.test(e.writer_id) || HEX_RUN_32.test(e.writer_id)) bad("writer_id");
  if (typeof e.app_version !== "string" || !APP_VERSION.test(e.app_version) || HEX_RUN_32.test(e.app_version)) bad("app_version");
  if (typeof e.occurred_at !== "string" || !TIMESTAMP.test(e.occurred_at)) bad("occurred_at");
  const t = Date.parse(e.occurred_at as string);
  if (Number.isNaN(t) || t < EARLIEST || t > now.getTime() + DAY_MS) bad("occurred_at");

  // per-type matrix
  const { req, opt } = MATRIX[type];
  const present = TYPE_SPECIFIC.filter(f => e[f] !== undefined);
  for (const f of req) if (e[f] === undefined) bad(f);
  for (const f of present) if (!req.includes(f) && !opt.includes(f)) bad(f);

  // values
  if (e.provider !== undefined && !oneOf(e.provider, PROVIDERS)) bad("provider");
  if (e.engine !== undefined && !oneOf(e.engine, ENGINES)) bad("engine");
  if (e.query_policy !== undefined && (typeof e.query_policy !== "string" || !QUERY_POLICY.test(e.query_policy))) bad("query_policy");
  if (e.sanitize_policy !== undefined && (typeof e.sanitize_policy !== "string" || !SANITIZE_POLICY.test(e.sanitize_policy))) bad("sanitize_policy");
  if (e.param_names !== undefined) {
    const names = e.param_names;
    if (!Array.isArray(names) || names.length < 1 || names.some(n => !oneOf(n, PARAM_NAMES))) bad("param_names");
    const arr = names as string[];
    if (arr.join("\x1f") !== sortedUnique(arr).join("\x1f")) bad("param_names");
  }
  if (e.query_length !== undefined && !isInt(e.query_length, type === "provider_attempt" ? 1 : 0, 256)) bad("query_length");
  if (e.has_location !== undefined && typeof e.has_location !== "boolean") bad("has_location");
  if (e.data_type !== undefined && !oneOf(e.data_type, DATA_TYPES)) bad("data_type");
  if (e.num_requested !== undefined && !isInt(e.num_requested, 1, 20)) bad("num_requested");
  if (e.save_requested !== undefined && typeof e.save_requested !== "boolean") bad("save_requested");
  if (e.rejected_field !== undefined && !oneOf(e.rejected_field, REJECTED_FIELDS)) bad("rejected_field");
  if (e.reason_codes !== undefined) {
    const codes = e.reason_codes;
    if (!Array.isArray(codes) || codes.length < 1 || codes.some(c => !oneOf(c, REASON_CODES))) bad("reason_codes");
    const arr = codes as string[];
    if (arr.join("\x1f") !== sortedUnique(arr).join("\x1f")) bad("reason_codes");
  }
  if (e.error_code !== undefined && (typeof e.error_code !== "string" || !ERROR_CODE.test(e.error_code))) bad("error_code");
  if (e.stage !== undefined && !oneOf(e.stage, STAGES)) bad("stage");
  if (e.result_count !== undefined && !isInt(e.result_count, 0, 100000)) bad("result_count");
  if (e.served_from_cache !== undefined && typeof e.served_from_cache !== "boolean") bad("served_from_cache");
  if (e.artifact_uuid !== undefined && (typeof e.artifact_uuid !== "string" || !UUID.test(e.artifact_uuid))) bad("artifact_uuid");
  if (e.artifact_hash !== undefined && (typeof e.artifact_hash !== "string" || !HASH_64.test(e.artifact_hash))) bad("artifact_hash");
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

function build(ctx: EventContext, type: EventType, fields: Record<string, unknown>): Readonly<LedgerEvent> {
  if (!EVENT_TYPES.includes(type)) bad("event_type");
  const seq = ctx.nextSeq();
  const now = ctx.now();
  const body: Record<string, unknown> = {
    event_id: ctx.uuid(),
    retrieval_id: ctx.retrievalId,
    seq,
    phase: PHASE_OF[type],
    event_type: type,
    schema_version: LEDGER_SCHEMA_VERSION,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) body[key] = value;
  body.writer_id = ctx.writerId;
  body.app_version = ctx.appVersion;
  body.occurred_at = now.toISOString();
  check(type, body, now);
  return deepFreeze({ ...body, row_hash: rowHash(body as Omit<LedgerEvent, "row_hash">) } as unknown as LedgerEvent);
}

// ─── Builders ────────────────────────────────────────────────────────────────────────────────────────────────────
// Each takes a closed facts object. Extra properties on it are ignored: nothing is copied except the named fields.

export interface RejectedFacts { engine?: Engine; queryPolicy: string; field: RejectedField; reasons: readonly ReasonCode[] }
export function buildQueryRejected(ctx: EventContext, f: RejectedFacts): Readonly<LedgerEvent> {
  return build(ctx, "query_rejected", {
    provider: "serpapi", engine: f.engine, query_policy: f.queryPolicy, rejected_field: f.field, reason_codes: sortedUnique(f.reasons),
  });
}

export interface AttemptFacts {
  engine: Engine; queryPolicy: string; paramNames: readonly string[]; queryLength: number; hasLocation: boolean;
  saveRequested: boolean; dataType?: DataType; numRequested?: number;
}
export function buildProviderAttempt(ctx: EventContext, f: AttemptFacts): Readonly<LedgerEvent> {
  return build(ctx, "provider_attempt", {
    provider: "serpapi", engine: f.engine, query_policy: f.queryPolicy, param_names: sortedUnique(f.paramNames),
    query_length: f.queryLength, has_location: f.hasLocation, save_requested: f.saveRequested,
    data_type: f.dataType, num_requested: f.numRequested,
  });
}

export interface SucceededFacts { engine: Engine; resultCount: number; servedFromCache?: boolean }
export function buildProviderSucceeded(ctx: EventContext, f: SucceededFacts): Readonly<LedgerEvent> {
  return build(ctx, "provider_succeeded", { provider: "serpapi", engine: f.engine, result_count: f.resultCount, served_from_cache: f.servedFromCache });
}

export interface FailedFacts { engine: Engine; errorCode: string }
export function buildProviderFailed(ctx: EventContext, f: FailedFacts): Readonly<LedgerEvent> {
  return build(ctx, "provider_failed", { provider: "serpapi", engine: f.engine, error_code: f.errorCode });
}

export interface ArchivedFacts { engine?: Engine; artifactUuid: string; artifactHash: string; sanitizePolicy: string }
export function buildArchiveSucceeded(ctx: EventContext, f: ArchivedFacts): Readonly<LedgerEvent> {
  return build(ctx, "archive_succeeded", {
    provider: f.engine ? "serpapi" : undefined, engine: f.engine,
    artifact_uuid: f.artifactUuid, artifact_hash: f.artifactHash, sanitize_policy: f.sanitizePolicy,
  });
}

export interface ArchiveFailedFacts { engine?: Engine; errorCode: ArchiveErrorCode; sanitizePolicy: string }
export function buildArchiveFailed(ctx: EventContext, f: ArchiveFailedFacts): Readonly<LedgerEvent> {
  if (!ARCHIVE_ERROR_CODES.includes(f.errorCode)) bad("error_code");
  return build(ctx, "archive_failed", {
    provider: f.engine ? "serpapi" : undefined, engine: f.engine, error_code: f.errorCode, sanitize_policy: f.sanitizePolicy,
  });
}

export interface SanitizationFailedFacts { engine?: Engine; stage: Stage; sanitizePolicy: string }
export function buildSanitizationFailed(ctx: EventContext, f: SanitizationFailedFacts): Readonly<LedgerEvent> {
  return build(ctx, "sanitization_failed", {
    provider: f.engine ? "serpapi" : undefined, engine: f.engine, stage: f.stage, sanitize_policy: f.sanitizePolicy,
  });
}

export interface OutputWithheldFacts { engine?: Engine; sanitizePolicy: string }
export function buildOutputWithheld(ctx: EventContext, f: OutputWithheldFacts): Readonly<LedgerEvent> {
  return build(ctx, "output_withheld", {
    provider: f.engine ? "serpapi" : undefined, engine: f.engine, stage: "output", sanitize_policy: f.sanitizePolicy,
  });
}
