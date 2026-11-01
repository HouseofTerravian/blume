// Process-local operational telemetry for the ledger writer. COUNTS, CLOSED CODES AND DURATION BUCKETS ONLY.
// Nothing here accepts free text: the counter names, failure classes and buckets are closed unions, so a query, a URL, a
// key, a provider message or a database message cannot be recorded even by mistake. Reset on process restart.

import type { FailureClass } from "./types.js";

export type CounterName =
  | "attempts_acked"
  | "attempts_refused"          // not acknowledged after bounded retries: no provider call
  | "attempts_refused_hard"     // refused on a HARD class (conflict, validation, permission...) or a build error
  | "events_ok"                 // inserted
  | "events_duplicate"          // acknowledged as a duplicate of an identical earlier send
  | "events_failed"             // an event the ledger did not acknowledge (after retries or hard)
  | "conflicts"                 // alert-grade: conflict or seq_conflict
  | "validation_failures"       // alert-grade: allowlist violation or a local build error
  | "retries"
  | "degraded_responses"        // responses returned with ledger_degraded
  | "rejections_recorded"
  | "rejections_lost"
  | "config_refusals";          // retrievals refused because strict-mode configuration is invalid

export const COUNTER_NAMES: readonly CounterName[] = [
  "attempts_acked", "attempts_refused", "attempts_refused_hard", "events_ok", "events_duplicate", "events_failed",
  "conflicts", "validation_failures", "retries", "degraded_responses", "rejections_recorded", "rejections_lost", "config_refusals",
];

export const FAILURE_CLASSES: readonly FailureClass[] = [
  "conflict", "seq_conflict", "validation", "permission", "auth", "function_missing", "protocol", "network", "timeout",
  "server", "rate_limited", "unknown",
];

/** Upper bounds in milliseconds; the last bucket is open-ended. */
export const LATENCY_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000] as const;

export interface TelemetrySnapshot {
  counters: Record<CounterName, number>;
  failures: Record<FailureClass, number>;
  latency_ms: Record<string, number>;
}

function zero<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;
}

function bucketLabel(ms: number): string {
  for (const bound of LATENCY_BUCKETS_MS) if (ms <= bound) return `<=${bound}`;
  return `>${LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1]}`;
}

export class Telemetry {
  private counters = zero(COUNTER_NAMES);
  private failures = zero(FAILURE_CLASSES);
  private latency: Record<string, number> = {};

  inc(name: CounterName, by = 1): void {
    this.counters[name] += by;
  }

  incFailure(cls: FailureClass): void {
    this.failures[cls] += 1;
  }

  observe(ms: number): void {
    const label = bucketLabel(Number.isFinite(ms) ? ms : 0);
    this.latency[label] = (this.latency[label] ?? 0) + 1;
  }

  snapshot(): TelemetrySnapshot {
    return { counters: { ...this.counters }, failures: { ...this.failures }, latency_ms: { ...this.latency } };
  }

  reset(): void {
    this.counters = zero(COUNTER_NAMES);
    this.failures = zero(FAILURE_CLASSES);
    this.latency = {};
  }
}

export const telemetry = new Telemetry();
