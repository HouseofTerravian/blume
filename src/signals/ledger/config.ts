// Ledger writer configuration.
//
//   BLUME_LEDGER_MODE   unset or "off"  -> off (default): the writer does nothing and today's behaviour is unchanged
//                       "strict"        -> every provider call requires a durably acknowledged provider_attempt
//                       anything else   -> treated as strict AND INVALID: it refuses, it never degrades to off
//
// There is NO automatic strict-to-off fallback. Once a process has resolved strict, the mode is latched for the life of
// the process, and a failure of any kind (database down, invalid settings, repeated errors) can only refuse retrievals.
// Switching to off is a Founder decision made by changing the setting and restarting; it is never done by the code.

import { config } from "../../config.js";

export type LedgerMode = "off" | "strict";

/** Closed list of reasons a strict configuration is unusable. */
export type ConfigReason =
  | "mode_invalid"
  | "writer_id_missing"
  | "writer_id_invalid"
  | "credentials_missing"
  | "numeric_invalid";

export interface RetryPolicy {
  timeoutMs: number;
  retries: number;
  backoffMs: readonly number[];
}

export interface LedgerConfig {
  mode: LedgerMode;
  /** false means strict was requested but cannot be honoured: every retrieval is refused. */
  valid: boolean;
  reason: ConfigReason | null;
  writerId: string | null;
  appVersion: string;
  attempt: RetryPolicy;
  outcome: RetryPolicy;
}

const WRITER_ID = /^[a-z0-9_-]{1,40}$/;
const HEX_RUN_32 = /[0-9A-Fa-f]{32}/;
const APP_VERSION = /^[0-9A-Za-z._+-]{1,40}$/;

const DEFAULT_ATTEMPT = { timeoutMs: 5000, retries: 2 };
const DEFAULT_OUTCOME = { timeoutMs: 3000, retries: 1 };
const BACKOFF_MS = [250, 750, 1500, 2000, 2000] as const;

function readInt(raw: string | undefined, fallback: number, lo: number, hi: number): number | null {
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^[0-9]{1,6}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= lo && n <= hi ? n : null;
}

export function resolveLedgerConfig(env: NodeJS.ProcessEnv = process.env): LedgerConfig {
  const rawMode = (env.BLUME_LEDGER_MODE ?? "").trim();
  const versionRaw = config.server.version;
  const appVersion = APP_VERSION.test(versionRaw) && !HEX_RUN_32.test(versionRaw) ? versionRaw : "0.0.0";

  const attemptTimeout = readInt(env.BLUME_LEDGER_ATTEMPT_TIMEOUT_MS, DEFAULT_ATTEMPT.timeoutMs, 500, 30000);
  const attemptRetries = readInt(env.BLUME_LEDGER_ATTEMPT_RETRIES, DEFAULT_ATTEMPT.retries, 0, 5);
  const outcomeTimeout = readInt(env.BLUME_LEDGER_OUTCOME_TIMEOUT_MS, DEFAULT_OUTCOME.timeoutMs, 500, 30000);
  const outcomeRetries = readInt(env.BLUME_LEDGER_OUTCOME_RETRIES, DEFAULT_OUTCOME.retries, 0, 5);

  const policies = {
    attempt: { timeoutMs: attemptTimeout ?? DEFAULT_ATTEMPT.timeoutMs, retries: attemptRetries ?? DEFAULT_ATTEMPT.retries, backoffMs: BACKOFF_MS },
    outcome: { timeoutMs: outcomeTimeout ?? DEFAULT_OUTCOME.timeoutMs, retries: outcomeRetries ?? DEFAULT_OUTCOME.retries, backoffMs: BACKOFF_MS },
  };

  if (rawMode === "" || rawMode === "off") {
    return { mode: "off", valid: true, reason: null, writerId: null, appVersion, ...policies };
  }
  const refuse = (reason: ConfigReason, writerId: string | null = null): LedgerConfig =>
    ({ mode: "strict", valid: false, reason, writerId, appVersion, ...policies });

  // Anything other than "strict" is NOT "off": an unrecognised value fails closed.
  if (rawMode !== "strict") return refuse("mode_invalid");

  const writerId = (env.BLUME_WRITER_ID ?? "").trim();
  if (writerId === "") return refuse("writer_id_missing");
  if (!WRITER_ID.test(writerId) || HEX_RUN_32.test(writerId)) return refuse("writer_id_invalid");
  if (attemptTimeout === null || attemptRetries === null || outcomeTimeout === null || outcomeRetries === null) return refuse("numeric_invalid", writerId);
  if (!(env.SUPABASE_URL ?? "").trim() || !(env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()) return refuse("credentials_missing", writerId);

  return { mode: "strict", valid: true, reason: null, writerId, appVersion, ...policies };
}

let latched: LedgerConfig | null = null;

/** Resolved once per process. A resolved strict configuration can never be replaced by an off one. */
export function getLedgerConfig(): LedgerConfig {
  if (latched === null) latched = resolveLedgerConfig();
  return latched;
}

/** Test seam only. Production code never calls this. */
export function __resetLedgerConfigForTests(): void {
  if (process.env.NODE_ENV !== "test") throw new Error("ledger config reset is only available when NODE_ENV=test");
  latched = null;
}
