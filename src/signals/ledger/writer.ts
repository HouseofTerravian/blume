// RetrievalRun: the writer for ONE retrieval.
//
//  * mints retrieval_id and hands out seq 1, 2, 3 in strict order; every write is awaited before the next event is created
//  * provider_attempt is ACK-REQUIRED: in strict mode nothing is sent to the provider unless it was durably acknowledged
//  * every other event is best-effort with bounded retries; a failure only marks the run "degraded"
//  * IDENTICAL RETRIES ONLY: an event is built once and frozen (same event_id, occurred_at, row_hash). A retry resends that
//    exact object. An event is never rebuilt, re-identified or amended after a failure; if it cannot be acknowledged it is
//    reported, not repaired. Hard failures (conflict, validation, permission...) are never retried.
//  * there is no automatic fallback to off: failures refuse or degrade, they never change the mode
//
// Nothing here reads a database message, and nothing here accepts query text, URLs or provider payloads.

import { QUERY_POLICY_VERSION, SANITIZATION_POLICY } from "../policy.js";
import {
  buildArchiveFailed, buildArchiveSucceeded, buildOutputWithheld, buildProviderAttempt, buildProviderFailed,
  buildProviderSucceeded, buildQueryRejected, buildSanitizationFailed, LedgerBuildError, type EventContext,
} from "./events.js";
import type { LedgerConfig, RetryPolicy } from "./config.js";
import type { Telemetry } from "./telemetry.js";
import {
  HARD_FAILURES, type AppendResult, type ArchiveErrorCode, type DataType, type Engine, type EventType, type FailureClass,
  type LedgerClient, type LedgerEvent, type ReasonCode, type RejectedField, type Stage,
} from "./types.js";

export type LedgerUnavailableCode = "ledger_unavailable" | "ledger_refused_hard" | "ledger_config_invalid";

const REFUSAL_MESSAGES: Record<LedgerUnavailableCode, string> = {
  ledger_unavailable: "retrieval refused: the retrieval ledger could not record the attempt; no provider request was made",
  ledger_refused_hard: "retrieval refused: the retrieval ledger rejected the attempt record; no provider request was made",
  ledger_config_invalid: "retrieval refused: the retrieval ledger is enabled but not correctly configured; no provider request was made",
};

/** Thrown before any provider call when the attempt is not durably acknowledged. Carries a closed code and no detail. */
export class LedgerUnavailable extends Error {
  constructor(public readonly code: LedgerUnavailableCode) {
    super(REFUSAL_MESSAGES[code]);
    this.name = "LedgerUnavailable";
  }
}

export type AttemptState = "not_required" | "pending" | "acked" | "refused";

export interface RunSummary {
  mode: "off" | "strict";
  attempt: AttemptState;
  degraded: boolean;
  /** Closed strings only: "<event_type>:<failure_class>", "config_invalid", "<event_type>:build_error". */
  degraded_codes: string[];
}

export interface WriterDeps {
  client: LedgerClient;
  config: LedgerConfig;
  telemetry: Telemetry;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  uuid: () => string;
}

type SendResult =
  | { outcome: "acked"; status: "inserted" | "duplicate"; tries: number }
  | { outcome: "hard"; cls: FailureClass; tries: number }
  | { outcome: "unacked"; cls: FailureClass; tries: number };

/** Bound a call so a hung client can never hang a retrieval, whatever the client does with its own timeout. */
function withDeadline(promise: Promise<AppendResult>, ms: number): Promise<AppendResult> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<AppendResult>(resolve => {
    timer = setTimeout(() => resolve({ ok: false, cls: "timeout" }), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export class RetrievalRun {
  readonly retrievalId: string;
  private seq = 0;
  private attemptState: AttemptState;
  private readonly degraded = new Set<string>();
  private degradedCounted = false;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly ctx: EventContext;

  constructor(private readonly deps: WriterDeps) {
    this.retrievalId = deps.uuid();
    this.attemptState = deps.config.mode === "off" ? "not_required" : "pending";
    this.ctx = {
      retrievalId: this.retrievalId,
      writerId: deps.config.writerId ?? "unconfigured",
      appVersion: deps.config.appVersion,
      nextSeq: () => ++this.seq,
      now: deps.now,
      uuid: deps.uuid,
    };
  }

  /** True when the ledger is in force (strict). Off means every method below is a no-op. */
  get active(): boolean {
    return this.deps.config.mode === "strict";
  }

  // ─── ordering ────────────────────────────────────────────────────────────────────────────────────────────────

  /** Serialise this run's writes so seq order always equals send order, even if a caller forgets to await. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.chain.then(fn);
    this.chain = result.then(() => undefined, () => undefined);
    return result;
  }

  // ─── sending: bounded retries of the IDENTICAL frozen event ──────────────────────────────────────────────────

  private async send(event: Readonly<LedgerEvent>, policy: RetryPolicy): Promise<SendResult> {
    const { telemetry, sleep, client } = this.deps;
    let last: FailureClass = "unknown";
    for (let i = 0; i <= policy.retries; i++) {
      const started = Date.now();
      let result: AppendResult;
      try {
        result = await withDeadline(client.append(event, { timeoutMs: policy.timeoutMs }), policy.timeoutMs + 250);
      } catch {
        result = { ok: false, cls: "unknown" };
      }
      telemetry.observe(Date.now() - started);
      if (result.ok) {
        telemetry.inc(result.status === "inserted" ? "events_ok" : "events_duplicate");
        return { outcome: "acked", status: result.status, tries: i + 1 };
      }
      telemetry.incFailure(result.cls);
      last = result.cls;
      if (HARD_FAILURES.has(result.cls)) {
        if (result.cls === "conflict" || result.cls === "seq_conflict") telemetry.inc("conflicts");
        if (result.cls === "validation") telemetry.inc("validation_failures");
        return { outcome: "hard", cls: result.cls, tries: i + 1 };
      }
      if (i < policy.retries) {
        telemetry.inc("retries");
        await sleep(policy.backoffMs[Math.min(i, policy.backoffMs.length - 1)] ?? 0);
      }
    }
    return { outcome: "unacked", cls: last, tries: policy.retries + 1 };
  }

  private markDegraded(code: string): void {
    this.degraded.add(code);
  }

  // ─── the acknowledged attempt ────────────────────────────────────────────────────────────────────────────────

  /**
   * Record the attempt and wait for the durable acknowledgement. Throws LedgerUnavailable (no provider call may follow)
   * if the ledger cannot acknowledge it, if the event is malformed, or if strict mode is misconfigured.
   */
  attempt(facts: {
    engine: Engine; queryLength: number; hasLocation: boolean; paramNames: readonly string[]; saveRequested: boolean;
    dataType?: DataType; numRequested?: number;
  }): Promise<void> {
    return this.enqueue(async () => {
      if (!this.active) return;
      const { config, telemetry } = this.deps;
      if (!config.valid) {
        this.attemptState = "refused";
        telemetry.inc("config_refusals");
        throw new LedgerUnavailable("ledger_config_invalid");
      }
      let event: Readonly<LedgerEvent>;
      try {
        event = buildProviderAttempt(this.ctx, { ...facts, queryPolicy: QUERY_POLICY_VERSION });
      } catch (err) {
        if (!(err instanceof LedgerBuildError)) throw err;
        this.attemptState = "refused";
        telemetry.inc("validation_failures");
        telemetry.inc("attempts_refused_hard");
        throw new LedgerUnavailable("ledger_refused_hard");
      }
      const sent = await this.send(event, config.attempt);
      if (sent.outcome === "acked") {
        this.attemptState = "acked";
        telemetry.inc("attempts_acked");
        return;
      }
      this.attemptState = "refused";
      if (sent.outcome === "hard") {
        telemetry.inc("attempts_refused_hard");
        throw new LedgerUnavailable("ledger_refused_hard");
      }
      telemetry.inc("attempts_refused");
      throw new LedgerUnavailable("ledger_unavailable");
    });
  }

  /**
   * Structural guard for the provider boundary. The provider fetch calls this FIRST, so a future caller that forgets to
   * await attempt() (or ignores its refusal) still cannot reach the network: in strict mode it throws unless the attempt
   * of THIS run was acknowledged. Off mode is a no-op.
   */
  assertProviderAllowed(): void {
    if (!this.active) return;
    if (!this.deps.config.valid) throw new LedgerUnavailable("ledger_config_invalid");
    if (this.attemptState !== "acked") throw new LedgerUnavailable("ledger_unavailable");
  }

  // ─── best-effort events ──────────────────────────────────────────────────────────────────────────────────────

  private outcome(type: EventType, make: () => Readonly<LedgerEvent>): Promise<void> {
    return this.enqueue(async () => {
      if (!this.active) return;
      const { config, telemetry } = this.deps;
      if (!config.valid) { this.markDegraded("config_invalid"); return; }
      // Never write an outcome for a retrieval whose attempt was not acknowledged (it would be an outcome without an attempt).
      if (this.attemptState !== "acked") { this.markDegraded(`${type}:not_attempted`); return; }
      let event: Readonly<LedgerEvent>;
      try {
        event = make();
      } catch (err) {
        if (!(err instanceof LedgerBuildError)) throw err;
        telemetry.inc("validation_failures");
        telemetry.inc("events_failed");
        this.markDegraded(`${type}:build_error`);
        return;
      }
      const sent = await this.send(event, config.outcome);
      if (sent.outcome !== "acked") {
        telemetry.inc("events_failed");
        this.markDegraded(`${type}:${sent.cls}`);
      }
    });
  }

  /** A retrieval rejected by screening. No provider call happens either way, so a failed write never changes the outcome. */
  rejected(facts: { engine?: Engine; field: RejectedField; reasons: readonly ReasonCode[] }): Promise<void> {
    return this.enqueue(async () => {
      if (!this.active) return;
      const { config, telemetry } = this.deps;
      if (!config.valid) { telemetry.inc("rejections_lost"); return; }
      let event: Readonly<LedgerEvent>;
      try {
        event = buildQueryRejected(this.ctx, { ...facts, queryPolicy: QUERY_POLICY_VERSION });
      } catch (err) {
        if (!(err instanceof LedgerBuildError)) throw err;
        telemetry.inc("validation_failures");
        telemetry.inc("rejections_lost");
        return;
      }
      const sent = await this.send(event, config.outcome);
      telemetry.inc(sent.outcome === "acked" ? "rejections_recorded" : "rejections_lost");
    });
  }

  providerSucceeded(facts: { engine: Engine; resultCount: number; servedFromCache?: boolean }): Promise<void> {
    return this.outcome("provider_succeeded", () => buildProviderSucceeded(this.ctx, facts));
  }

  providerFailed(facts: { engine: Engine; errorCode: string }): Promise<void> {
    return this.outcome("provider_failed", () => buildProviderFailed(this.ctx, facts));
  }

  archived(facts: { engine?: Engine; artifactUuid: string; artifactHash: string }): Promise<void> {
    return this.outcome("archive_succeeded", () => buildArchiveSucceeded(this.ctx, { ...facts, sanitizePolicy: SANITIZATION_POLICY }));
  }

  archiveFailed(facts: { engine?: Engine; errorCode: ArchiveErrorCode }): Promise<void> {
    return this.outcome("archive_failed", () => buildArchiveFailed(this.ctx, { ...facts, sanitizePolicy: SANITIZATION_POLICY }));
  }

  sanitizationFailed(facts: { engine?: Engine; stage: Stage }): Promise<void> {
    return this.outcome("sanitization_failed", () => buildSanitizationFailed(this.ctx, { ...facts, sanitizePolicy: SANITIZATION_POLICY }));
  }

  outputWithheld(facts: { engine?: Engine }): Promise<void> {
    return this.outcome("output_withheld", () => buildOutputWithheld(this.ctx, { ...facts, sanitizePolicy: SANITIZATION_POLICY }));
  }

  /** Resolve once all queued writes have finished, then describe the run with closed codes only. */
  async summary(): Promise<RunSummary> {
    await this.chain;
    const degraded = this.degraded.size > 0;
    if (degraded && !this.degradedCounted) {
      this.degradedCounted = true;
      this.deps.telemetry.inc("degraded_responses");
    }
    return {
      mode: this.deps.config.mode,
      attempt: this.attemptState,
      degraded,
      degraded_codes: [...this.degraded].sort(),
    };
  }
}
