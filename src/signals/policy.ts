// TPIG query & PII policy — enforcement. Canonical text: docs/doctrine/tpig-query-and-pii-policy.md
//
//   tpig-query-policy-1  what may be sent to a provider (input screening, reject-only, fail closed)
//   tpig-sanitize-2      what may be stored, logged or returned (redaction + residual verification)
//
// Detection is pattern-based and best-effort. It catches STRUCTURED identifiers and credential shapes.
// It cannot recognise a private individual's name or free-text personal narrative; that rule is
// enforced by the human-approved-use clause of the policy, not by this module.

import { config } from "../config.js";
import { RAW_SIGNAL_KIND } from "../artifacts/store.js";

export const QUERY_POLICY_VERSION = "tpig-query-policy-1";
export const SANITIZATION_POLICY = "tpig-sanitize-2";
export const MAX_QUERY_LENGTH = 256;
export const MAX_LOCATION_LENGTH = 128;

export const REDACTED_CAPABILITY_URL = "[REDACTED:provider-capability-url]";
export const REDACTED_CREDENTIAL = "[REDACTED:credential]";

export type ReasonCode =
  | "invalid_type"
  | "empty"
  | "too_long"
  | "control_characters"
  | "invalid_format"
  | "email"
  | "phone"
  | "national_id"
  | "payment_card"
  | "iban"
  | "street_address"
  | "credential"
  | "tokenized_url";

/** Message carries field name and reason codes only, never the rejected text. */
export class PolicyViolation extends Error {
  constructor(public readonly field: string, public readonly reasons: ReasonCode[]) {
    super(`query rejected by ${QUERY_POLICY_VERSION}: field "${field}": ${reasons.join(", ")}`);
    this.name = "PolicyViolation";
  }
}

/** Raised when redaction cannot be verified. Never carries content. */
export class SanitizationFailure extends Error {
  constructor(public readonly stage: string) {
    super(`sanitization failed at ${stage} (policy ${SANITIZATION_POLICY}); nothing was stored or returned`);
    this.name = "SanitizationFailure";
  }
}

// ─── Patterns ────────────────────────────────────────────────────────────────

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const PHONE_PATTERNS: RegExp[] = [
  /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/,
  /(?<![\w+])\+\d{8,15}(?!\d)/,
  /(?<!\d)\d{10}(?!\d)/,
];
const NATIONAL_ID = /(?<!\d)\d{3}[- ]\d{2}[- ]\d{4}(?!\d)/;
const CARD_CANDIDATE = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;
const IBAN_CANDIDATE = /(?<![A-Za-z0-9])[A-Za-z]{2}\d{2}(?: ?[A-Za-z0-9]{4}){2,7}(?: ?[A-Za-z0-9]{1,4})?(?![A-Za-z0-9])/g;
const PO_BOX = /\bp\.?\s?o\.?\s?box\s+\d+/i;

const STREET_SUFFIX = "street|st|avenue|ave|boulevard|blvd|lane|ln|road|rd|drive|dr";
// Query mode: house number + 1-4 words + suffix, only when the address-like run ends the query, is followed by a
// comma, a unit marker or a ZIP. This keeps "10 best street food in austin" and "10 best road trips" legitimate.
const STREET_IN_QUERY = new RegExp(
  `\\b\\d{1,6}\\s+(?:[a-z0-9.'-]+\\s+){1,4}?(?:${STREET_SUFFIX})\\b\\.?(?=\\s*(?:,|$)|\\s+(?:apt|apartment|suite|ste|unit|#)\\b|\\s+\\d{5}\\b)`,
  "i",
);
// Locality mode (location field): no lookahead. A location is a city/region/country, never a house number.
const STREET_IN_LOCALITY = new RegExp(`\\b\\d{1,6}\\s+(?:[a-z0-9.'-]+\\s+){1,4}?(?:${STREET_SUFFIX})\\b`, "i");

const CREDENTIAL_PATTERNS: RegExp[] = [
  /\bsb_secret_[A-Za-z0-9_-]{8,}/g,
  /\bsapi_[A-Za-z0-9]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\bBearer\s+(?!\[REDACTED)[A-Za-z0-9._~+/=-]{16,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];
// name = value where the value looks secret-like (>=6 chars with a digit, or >=16 chars). Idempotent over markers.
const KEY_VALUE =
  /\b(api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|secret|password|passwd|token)(\s*[=:]\s*)(["']?)(?!\[REDACTED)((?=[^\s"'&,;]*\d)[^\s"'&,;]{6,}|[^\s"'&,;]{16,})/gi;
const HEX64_INPUT_ONLY = /(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/i;

const URL_IN_TEXT = /https?:\/\/[^\s"'<>]+/gi;
const URL_USERINFO = /^https?:\/\/[^/\s@]+@/i;
const SERPAPI_CAPABILITY_URL = /https?:\/\/(?:[a-z0-9-]+\.)*serpapi\.com\/searches\/[^\s"'<>\\)]*/gi;
const URL_TOKEN_PARAM =
  /([?&](?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|token|key|sig|signature|secret|password|session(?:id)?)=)(?!\[REDACTED)([^&\s"'<>#\\]+)/gi;

const SENSITIVE_KEY = /^(api[_-]?key|apikey|access[_-]?token|auth[_-]?token|authorization|client[_-]?secret|secret|password|passwd|token)$/i;

function has(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  const hit = re.test(text);
  re.lastIndex = 0;
  return hit;
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function ibanValid(raw: string): boolean {
  const s = raw.replace(/ /g, "").toUpperCase();
  if (s.length < 15 || s.length > 34) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

/** Secrets this process knows about. Redacted wherever they appear, in addition to the shape patterns. */
function knownSecrets(): string[] {
  return [
    config.serpapi.apiKey,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    process.env.ANTHROPIC_API_KEY ?? "",
    process.env.OPENAI_API_KEY ?? "",
  ].filter(s => s.length >= 8);
}

// ─── Input screening (tpig-query-policy-1) ───────────────────────────────────

export type ScreenMode = "query" | "locality";

export function detectIdentifiers(text: string, mode: ScreenMode): ReasonCode[] {
  const reasons = new Set<ReasonCode>();
  if (has(EMAIL, text)) reasons.add("email");
  if (PHONE_PATTERNS.some(p => has(p, text))) reasons.add("phone");
  if (has(NATIONAL_ID, text)) reasons.add("national_id");
  for (const m of text.matchAll(CARD_CANDIDATE)) {
    const digits = m[0].replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) reasons.add("payment_card");
  }
  for (const m of text.matchAll(IBAN_CANDIDATE)) {
    if (ibanValid(m[0])) reasons.add("iban");
  }
  if (has(PO_BOX, text) || has(mode === "locality" ? STREET_IN_LOCALITY : STREET_IN_QUERY, text)) {
    reasons.add("street_address");
  }
  if (
    CREDENTIAL_PATTERNS.some(p => has(p, text)) ||
    has(KEY_VALUE, text) ||
    has(HEX64_INPUT_ONLY, text) ||
    knownSecrets().some(s => text.includes(s))
  ) {
    reasons.add("credential");
  }
  for (const m of text.matchAll(URL_IN_TEXT)) {
    if (has(URL_USERINFO, m[0]) || has(URL_TOKEN_PARAM, m[0]) || has(SERPAPI_CAPABILITY_URL, m[0])) {
      reasons.add("tokenized_url");
    }
  }
  if (has(SERPAPI_CAPABILITY_URL, text)) reasons.add("tokenized_url");
  return [...reasons];
}

/** Validate and screen one free-text provider parameter. Returns the trimmed value or throws PolicyViolation. */
export function screenText(
  field: string,
  value: unknown,
  opts: { max: number; mode: ScreenMode; required: boolean },
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.required) throw new PolicyViolation(field, [value === undefined || value === null ? "invalid_type" : "empty"]);
    return undefined;
  }
  if (typeof value !== "string") throw new PolicyViolation(field, ["invalid_type"]);
  const text = value.trim();
  if (!text) {
    if (opts.required) throw new PolicyViolation(field, ["empty"]);
    return undefined;
  }
  if (text.length > opts.max) throw new PolicyViolation(field, ["too_long"]);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new PolicyViolation(field, ["control_characters"]);
  const reasons = detectIdentifiers(text, opts.mode);
  if (reasons.length) throw new PolicyViolation(field, reasons);
  return text;
}

const GEO = /^[A-Za-z]{2}(?:-[A-Za-z0-9]{1,3})?$/;
const TRENDS_DATE =
  /^(?:all|(?:now|today) \d{1,2}-[HhdmMy]|\d{4}-\d{2}-\d{2}(?:T\d{2})?(?: \d{4}-\d{2}-\d{2}(?:T\d{2})?)?)$/;

export function screenGeo(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new PolicyViolation("geo", ["invalid_type"]);
  const v = value.trim();
  if (!GEO.test(v)) throw new PolicyViolation("geo", ["invalid_format"]);
  return v;
}

export function screenTrendsDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new PolicyViolation("date", ["invalid_type"]);
  const v = value.trim();
  if (!TRENDS_DATE.test(v)) throw new PolicyViolation("date", ["invalid_format"]);
  return v;
}

export function screenEnum<T extends string>(field: string, value: unknown, allowed: readonly T[], fallback: T): T {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new PolicyViolation(field, ["invalid_type"]);
  if (!(allowed as readonly string[]).includes(value)) throw new PolicyViolation(field, ["invalid_format"]);
  return value as T;
}

// ─── Redaction (tpig-sanitize-2) ─────────────────────────────────────────────

let redactionFault = false;
/** Test seam: simulates a redactor that misses content so the residual check can be exercised. */
export function __injectRedactionFaultForTests(on: boolean): void {
  if (process.env.NODE_ENV !== "test") throw new Error("redaction fault injection is only available when NODE_ENV=test");
  redactionFault = on;
}

function applyRedactions(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  const bump = (re: RegExp, replace: string | ((...m: string[]) => string)) => {
    out = out.replace(re, (...m: unknown[]) => {
      count++;
      return typeof replace === "string" ? replace : replace(...(m as string[]));
    });
  };
  for (const s of knownSecrets()) {
    if (out.includes(s)) {
      count++;
      out = out.split(s).join(REDACTED_CREDENTIAL);
    }
  }
  bump(SERPAPI_CAPABILITY_URL, REDACTED_CAPABILITY_URL);
  for (const re of CREDENTIAL_PATTERNS) bump(re, REDACTED_CREDENTIAL);
  bump(KEY_VALUE, (_m, name, sep, quote) => `${name}${sep}${quote}${REDACTED_CREDENTIAL}`);
  bump(URL_TOKEN_PARAM, (_m, prefix) => `${prefix}${REDACTED_CREDENTIAL}`);
  return { text: out, count };
}

export function redactText(text: string): { text: string; count: number } {
  return redactionFault ? { text, count: 0 } : applyRedactions(text);
}

/** True when a second, fault-free pass finds nothing left to redact. Used to verify redaction, never to repair it. */
export function isClean(text: string): boolean {
  return applyRedactions(text).count === 0;
}

export function redactValue(
  value: unknown,
  pathParts: string[] = [],
  redactedPaths: string[] = [],
): { value: unknown; redactedPaths: string[] } {
  const walk = (v: unknown, p: string[]): unknown => {
    if (typeof v === "string") {
      const r = redactText(v);
      if (r.count > 0) redactedPaths.push(p.join("."));
      return r.text;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, [...p, String(i)]));
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, x]) => {
          if (SENSITIVE_KEY.test(k) && (typeof x === "string" || typeof x === "number")) {
            redactedPaths.push([...p, k].join("."));
            return [k, REDACTED_CREDENTIAL];
          }
          return [k, walk(x, [...p, k])];
        }),
      );
    }
    return v;
  };
  return { value: walk(value, pathParts), redactedPaths };
}

/** Redact a structure and verify the result. Throws SanitizationFailure rather than returning unverified data. */
export function sanitizeStructure(
  value: unknown,
  stage: string,
  pathParts: string[] = [],
): { value: unknown; redactedPaths: string[] } {
  let result: { value: unknown; redactedPaths: string[] };
  try {
    result = redactValue(value, pathParts);
    if (!isClean(JSON.stringify(result.value) ?? "")) throw new SanitizationFailure(stage);
  } catch (err) {
    throw err instanceof SanitizationFailure ? err : new SanitizationFailure(stage);
  }
  return result;
}

/** Redact and verify one string (titles, error text). Throws SanitizationFailure on residue. */
export function sanitizeString(text: string, stage: string): string {
  const r = redactText(text);
  if (!isClean(r.text)) throw new SanitizationFailure(stage);
  return r.text;
}

// ─── Provider errors ─────────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Build a caller-safe provider error. Only a status/code and, when it is provably clean, the provider's own
 * short message are kept. The provider message is dropped if it was changed by redaction, still looks unclean,
 * is long, or contains any value the caller supplied (a provider echoing the query back).
 */
export function safeProviderError(
  provider: string,
  parts: { status?: number; code?: string; providerMessage?: unknown },
  suppliedValues: string[],
): ProviderError {
  const head = parts.status ? `${provider} request failed (HTTP ${parts.status})` : parts.code ? `${provider} request failed (${parts.code})` : `${provider} request failed`;
  const msg = typeof parts.providerMessage === "string" ? parts.providerMessage.trim() : "";
  if (msg && msg.length <= 200) {
    const lower = msg.toLowerCase();
    const echoes = suppliedValues.some(v => v.length >= 3 && lower.includes(v.toLowerCase()));
    const r = redactText(msg);
    if (!echoes && r.count === 0 && isClean(msg) && detectIdentifiers(msg, "query").length === 0) {
      return new ProviderError(`${head}: ${msg}`);
    }
  }
  return new ProviderError(head);
}

// ─── Read-time redaction (non-mutating) ──────────────────────────────────────

type ArtifactLike = { title?: string; body?: string | null; metadata?: Record<string, unknown> };

/**
 * Returns a redacted COPY of a raw-signal artifact for an MCP read. Stored records, their bodies and their
 * recorded `hash` are never touched; `hash` in the copy still describes the stored body, not the redacted one.
 * Non-raw-signal artifacts are returned unchanged.
 */
export function redactArtifactForRead<T extends ArtifactLike>(artifact: T): T & { read_redacted?: boolean; read_redaction_count?: number } {
  if (artifact.metadata?.kind !== RAW_SIGNAL_KIND) return artifact;
  const copy = structuredClone(artifact) as T & { read_redacted?: boolean; read_redaction_count?: number };
  let count = 0;
  const redactAndCount = (v: unknown): unknown => {
    const paths: string[] = [];
    const r = redactValue(v, [], paths);
    count += paths.length;
    return r.value;
  };
  if (typeof copy.title === "string") {
    const r = redactText(copy.title);
    count += r.count > 0 ? 1 : 0;
    (copy as ArtifactLike).title = r.text;
  }
  if (copy.metadata) (copy as ArtifactLike).metadata = redactAndCount(copy.metadata) as Record<string, unknown>;
  if (typeof copy.body === "string") {
    let redactedBody: string;
    try {
      redactedBody = JSON.stringify(redactAndCount(JSON.parse(copy.body)), null, 2);
    } catch {
      const r = redactText(copy.body);
      count += r.count > 0 ? 1 : 0;
      redactedBody = r.text;
    }
    // Fail closed: if the redacted copy is not verifiably clean, withhold the body rather than return it.
    (copy as ArtifactLike).body = isClean(redactedBody) ? redactedBody : "[WITHHELD:redaction-unverified]";
    if (!isClean(redactedBody)) count++;
  }
  copy.read_redacted = count > 0;
  copy.read_redaction_count = count;
  return copy;
}
