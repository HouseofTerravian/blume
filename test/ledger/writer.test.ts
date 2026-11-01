import "./setup.js";
import test, { describe, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./setup.js";
import { LedgerUnavailable } from "../../src/signals/ledger/writer.js";
import { COUNTER_NAMES, FAILURE_CLASSES, telemetry } from "../../src/signals/ledger/telemetry.js";
import { HARD_FAILURES, type AppendResult, type FailureClass, type LedgerClient, type LedgerEvent } from "../../src/signals/ledger/types.js";
import { ATTEMPT, FakeLedgerDb, makeConfig, makeDeps, newRun, STRICT_CONFIG } from "./support.js";

after(cleanup);
beforeEach(() => telemetry.reset());

const refusal = (code: string) => (e: unknown) => e instanceof LedgerUnavailable && e.code === code;

describe("the provider attempt is ack-required", () => {
  test("W1 acknowledged on the first try: state acked, one send", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    const s = await run.summary();
    assert.equal(s.attempt, "acked");
    assert.equal(db.sent.length, 1);
    assert.deepEqual(db.typesOf(run.retrievalId), ["provider_attempt"]);
    assert.equal(telemetry.snapshot().counters.attempts_acked, 1);
  });

  test("W2 a network failure is retried and the retry is acknowledged", async () => {
    const db = new FakeLedgerDb();
    db.script = [{ kind: "fail", cls: "network" }];
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    assert.equal(db.sent.length, 2);
    assert.equal((await run.summary()).attempt, "acked");
    assert.equal(telemetry.snapshot().counters.retries, 1);
  });

  test("W3 the first send committed but its acknowledgement was lost: the retry returns duplicate and counts as acknowledged", async () => {
    const db = new FakeLedgerDb();
    db.script = [{ kind: "commit_then_fail", cls: "timeout" }];
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    assert.equal(db.rows.size, 1, "exactly one row, not two");
    assert.equal(telemetry.snapshot().counters.events_duplicate, 1);
    assert.equal((await run.summary()).attempt, "acked");
  });

  test("W4 still unacknowledged after bounded retries: LedgerUnavailable, 1 + retries sends, state refused", async () => {
    const db = new FakeLedgerDb();
    db.down = true;
    const run = newRun(db);
    await assert.rejects(run.attempt(ATTEMPT), refusal("ledger_unavailable"));
    assert.equal(db.sent.length, 1 + STRICT_CONFIG.attempt.retries);
    assert.equal((await run.summary()).attempt, "refused");
    const c = telemetry.snapshot().counters;
    assert.equal(c.attempts_refused, 1);
    assert.equal(c.retries, STRICT_CONFIG.attempt.retries);
  });

  test("W5 every HARD class refuses at once and is never retried", async () => {
    for (const cls of HARD_FAILURES) {
      const db = new FakeLedgerDb();
      db.script = [{ kind: "fail", cls }];
      const run = newRun(db);
      await assert.rejects(run.attempt(ATTEMPT), refusal("ledger_refused_hard"), cls);
      assert.equal(db.sent.length, 1, `${cls} must not be retried`);
    }
  });

  test("W5b every retryable class IS retried", async () => {
    for (const cls of ["network", "timeout", "server", "rate_limited", "unknown"] as FailureClass[]) {
      const db = new FakeLedgerDb();
      db.script = [{ kind: "fail", cls }];
      const run = newRun(db);
      await run.attempt(ATTEMPT);
      assert.equal(db.sent.length, 2, `${cls} should be retried once and then acknowledged`);
    }
  });

  test("W6 a real conflict (same event_id, different payload already stored) is hard and not retried", async () => {
    const db = new FakeLedgerDb();
    const deps = makeDeps(db);
    // The writer will use: retrieval_id = uuid #1, event_id = uuid #2. Pre-seed a DIFFERENT event under that event_id.
    const ids: string[] = [];
    const uuid = () => { const v = deps.uuid(); ids.push(v); return v; };
    const run = new (await import("../../src/signals/ledger/writer.js")).RetrievalRun({ ...deps, uuid });
    const eventId = `00000000-0000-4000-8000-${String(Number(ids[0].slice(-12)) + 1).padStart(12, "0")}`;
    db.rows.set(eventId, { event_id: eventId, row_hash: "f".repeat(64) } as LedgerEvent);
    await assert.rejects(run.attempt(ATTEMPT), refusal("ledger_refused_hard"));
    assert.equal(db.sent.length, 1);
    assert.equal(telemetry.snapshot().counters.conflicts, 1);
  });

  test("W7 a hung client cannot hang a retrieval: the writer's own deadline refuses", async () => {
    const db = new FakeLedgerDb();
    db.script = [{ kind: "hang" }, { kind: "hang" }, { kind: "hang" }];
    const run = newRun(db, { config: makeConfig({ attempt: { timeoutMs: 30, retries: 2, backoffMs: [1, 1] } }) });
    const started = Date.now();
    // Bounded wait: without the writer's deadline this fails by assertion after 4 s instead of hanging until the runner's timeout.
    const outcome = await Promise.race([
      run.attempt(ATTEMPT).then(() => "resolved", (e: unknown) => e),
      new Promise<string>(resolve => setTimeout(() => resolve("HUNG"), 4000)),
    ]);
    assert.notEqual(outcome, "HUNG", "a hung client must not hang the retrieval: the writer's own deadline must fire");
    assert.ok(outcome instanceof LedgerUnavailable && outcome.code === "ledger_unavailable", "refused with the closed code");
    assert.ok(Date.now() - started < 3000, "returned within the bounded deadlines");
    assert.equal(db.sent.length, 3);
  });

  test("W8 a client that throws is treated as an unknown, retryable failure", async () => {
    const db = new FakeLedgerDb();
    db.script = [{ kind: "throw" }];
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    assert.equal(db.sent.length, 2);
    assert.equal((await run.summary()).attempt, "acked");
  });

  test("W9 a malformed attempt (builder error) is refused hard before anything is sent", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await assert.rejects(run.attempt({ ...ATTEMPT, queryLength: 0 }), refusal("ledger_refused_hard"));
    assert.equal(db.sent.length, 0);
    assert.equal(telemetry.snapshot().counters.validation_failures, 1);
  });

  test("W10 retries use the configured backoff and respect retries = 0", async () => {
    const waits: number[] = [];
    const db = new FakeLedgerDb();
    db.down = true;
    const run = newRun(db, { sleep: async ms => { waits.push(ms); } });
    await assert.rejects(run.attempt(ATTEMPT), LedgerUnavailable);
    assert.deepEqual(waits, [250, 750]);
    const db2 = new FakeLedgerDb();
    db2.down = true;
    const run2 = newRun(db2, { config: makeConfig({ attempt: { timeoutMs: 1000, retries: 0, backoffMs: [250] } }) });
    await assert.rejects(run2.attempt(ATTEMPT), LedgerUnavailable);
    assert.equal(db2.sent.length, 1);
  });
});

describe("identical frozen-event retries only", () => {
  test("W11 every retry resends byte-identical content (same event_id, occurred_at, row_hash)", async () => {
    const db = new FakeLedgerDb();
    db.script = [{ kind: "fail", cls: "network" }, { kind: "fail", cls: "server" }];
    let tick = 0;
    const run = newRun(db, { now: () => new Date(Date.parse("2026-11-01T12:00:00.000Z") + 1000 * tick++) });
    await run.attempt(ATTEMPT);
    assert.equal(db.sent.length, 3);
    assert.equal(new Set(db.sent).size, 1, "all three sends are identical");
    assert.equal(tick, 1, "the clock was read once: an event is not rebuilt for a retry");
  });

  test("W12 the very same frozen object is handed to the client on every try", async () => {
    const seen: LedgerEvent[] = [];
    let n = 0;
    const client: LedgerClient = {
      async append(e): Promise<AppendResult> { seen.push(e as LedgerEvent); return ++n < 3 ? { ok: false, cls: "network" } : { ok: true, status: "inserted" }; },
    };
    const run = newRun(client);
    await run.attempt(ATTEMPT);
    assert.equal(seen.length, 3);
    assert.ok(seen[0] === seen[1] && seen[1] === seen[2], "same reference");
    assert.ok(Object.isFrozen(seen[0]));
  });

  test("W13 a failed event is never re-identified or resent later; the next event gets the next seq and a new id", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    db.failTypes.set("provider_succeeded", "network");
    await run.providerSucceeded({ engine: "google", resultCount: 3 });
    db.failTypes.clear();
    await run.archived({ engine: "google", artifactUuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", artifactHash: "a".repeat(64) });
    assert.deepEqual(db.seqsOf(run.retrievalId), [1, 3], "seq 2 stays a visible gap; nothing was repaired");
    assert.equal(db.sent.filter(s => JSON.parse(s).event_type === "provider_succeeded").length, 2, "the failed event was tried 1 + outcome.retries times, and no more");
    const ids = db.sent.map(s => JSON.parse(s).event_id);
    assert.equal(new Set(ids).size, 3, "three distinct events; the failed one was never reissued under a new id");
  });
});

describe("best-effort events and the degraded signal", () => {
  test("W14 an unacknowledged outcome marks the run degraded with a closed code; the run continues", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    db.failTypes.set("provider_succeeded", "network");
    await run.providerSucceeded({ engine: "google", resultCount: 3 });
    const s = await run.summary();
    assert.equal(s.degraded, true);
    assert.deepEqual(s.degraded_codes, ["provider_succeeded:network"]);
    assert.equal(s.attempt, "acked");
    assert.equal(telemetry.snapshot().counters.degraded_responses, 1);
  });

  test("W15 a hard failure on an outcome is reported (and counted as a conflict) but never retried", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    db.failTypes.set("archive_succeeded", "seq_conflict");
    await run.archived({ engine: "google", artifactUuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", artifactHash: "a".repeat(64) });
    assert.deepEqual((await run.summary()).degraded_codes, ["archive_succeeded:seq_conflict"]);
    assert.equal(db.sent.filter(s => JSON.parse(s).event_type === "archive_succeeded").length, 1);
    assert.equal(telemetry.snapshot().counters.conflicts, 1);
  });

  test("W16 degraded codes are deduplicated and sorted; counted once per run", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    db.failTypes.set("provider_succeeded", "server");
    db.failTypes.set("output_withheld", "network");
    await run.providerSucceeded({ engine: "google", resultCount: 1 });
    await run.outputWithheld({ engine: "google" });
    const first = await run.summary();
    const second = await run.summary();
    assert.deepEqual(first.degraded_codes, ["output_withheld:network", "provider_succeeded:server"]);
    assert.deepEqual(first, second);
    assert.equal(telemetry.snapshot().counters.degraded_responses, 1);
  });

  test("W17 no outcome is ever written for a retrieval whose attempt was not acknowledged", async () => {
    const db = new FakeLedgerDb();
    db.down = true;
    const run = newRun(db);
    await assert.rejects(run.attempt(ATTEMPT), LedgerUnavailable);
    db.down = false;
    const before = db.sent.length;
    await run.providerSucceeded({ engine: "google", resultCount: 1 });
    assert.equal(db.sent.length, before, "nothing sent");
    assert.deepEqual((await run.summary()).degraded_codes, ["provider_succeeded:not_attempted"]);
  });

  test("W18 a malformed outcome is reported as build_error and never sent", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    const sentBefore = db.sent.length;
    await run.providerSucceeded({ engine: "google", resultCount: -5 });
    assert.equal(db.sent.length, sentBefore);
    assert.deepEqual((await run.summary()).degraded_codes, ["provider_succeeded:build_error"]);
  });

  test("W19 a rejected query is recorded best-effort; a write failure never throws and is counted as lost", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    await run.rejected({ field: "q", reasons: ["email"] });
    assert.deepEqual(db.typesOf(run.retrievalId), ["query_rejected"]);
    assert.equal(telemetry.snapshot().counters.rejections_recorded, 1);
    const run2 = newRun(db);
    db.down = true;
    await run2.rejected({ field: "q", reasons: ["phone"] });
    assert.equal(telemetry.snapshot().counters.rejections_lost, 1);
    const run3 = newRun(db);
    db.down = false;
    await run3.rejected({ field: "password" as never, reasons: ["email"] });
    assert.equal(telemetry.snapshot().counters.rejections_lost, 2, "a malformed rejection is lost, not thrown");
    assert.equal((await run2.summary()).degraded, false, "rejections never degrade a response");
  });
});

describe("ordering and sequencing", () => {
  test("W20 writes are serialised: not awaiting each call still sends in seq order, one at a time", async () => {
    const db = new FakeLedgerDb();
    db.delayMs = 5;
    const run = newRun(db);
    const done = [
      run.attempt(ATTEMPT),
      run.providerSucceeded({ engine: "google", resultCount: 1 }),
      run.archived({ engine: "google", artifactUuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", artifactHash: "a".repeat(64) }),
    ];
    await Promise.all(done);
    assert.deepEqual(db.sent.map(s => JSON.parse(s).seq), [1, 2, 3]);
    assert.equal(db.maxInFlight, 1);
    assert.deepEqual(db.typesOf(run.retrievalId), ["provider_attempt", "provider_succeeded", "archive_succeeded"]);
  });
});

describe("no automatic strict-to-off fallback", () => {
  test("W21 repeated failures never change the mode; each later retrieval is refused too", async () => {
    const db = new FakeLedgerDb();
    db.down = true;
    for (let i = 0; i < 6; i++) {
      const run = newRun(db);
      await assert.rejects(run.attempt(ATTEMPT), LedgerUnavailable);
      assert.equal((await run.summary()).mode, "strict");
      assert.equal(run.active, true);
    }
    assert.equal(telemetry.snapshot().counters.attempts_refused, 6);
    assert.equal(telemetry.snapshot().counters.attempts_acked, 0);
  });

  test("W22 an invalid strict configuration refuses every attempt (no provider call) and still never becomes off", async () => {
    const db = new FakeLedgerDb();
    const bad = makeConfig({ valid: false, reason: "writer_id_missing", writerId: null });
    const run = newRun(db, { config: bad });
    await assert.rejects(run.attempt(ATTEMPT), refusal("ledger_config_invalid"));
    assert.equal(db.sent.length, 0);
    assert.equal(run.active, true);
    assert.equal(telemetry.snapshot().counters.config_refusals, 1);
    await run.rejected({ field: "q", reasons: ["email"] });
    assert.equal(telemetry.snapshot().counters.rejections_lost, 1);
    assert.deepEqual((await run.summary()).mode, "strict");
  });
});

describe("off mode is inert", () => {
  test("W23 off: every method is a no-op, nothing is sent, nothing is thrown", async () => {
    const db = new FakeLedgerDb();
    db.down = true;
    const run = newRun(db, { config: makeConfig({ mode: "off", valid: true, writerId: null }) });
    assert.equal(run.active, false);
    await run.rejected({ field: "q", reasons: ["email"] });
    await run.attempt(ATTEMPT);
    await run.providerSucceeded({ engine: "google", resultCount: 1 });
    await run.providerFailed({ engine: "google", errorCode: "timeout" });
    await run.archived({ artifactUuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", artifactHash: "a".repeat(64) });
    await run.archiveFailed({ errorCode: "archive_write" });
    await run.sanitizationFailed({ stage: "output" });
    await run.outputWithheld({});
    assert.equal(db.sent.length, 0);
    const s = await run.summary();
    assert.deepEqual([s.mode, s.attempt, s.degraded, s.degraded_codes], ["off", "not_required", false, []]);
  });
});

describe("telemetry is closed", () => {
  test("W24 a snapshot has only the declared counter, failure-class and bucket names", async () => {
    const db = new FakeLedgerDb();
    db.script = [{ kind: "fail", cls: "server" }];
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    const snap = telemetry.snapshot();
    assert.deepEqual(Object.keys(snap.counters).sort(), [...COUNTER_NAMES].sort());
    assert.deepEqual(Object.keys(snap.failures).sort(), [...FAILURE_CLASSES].sort());
    assert.equal(snap.failures.server, 1);
    for (const k of Object.keys(snap.latency_ms)) assert.match(k, /^(<=\d+|>\d+)$/);
    for (const v of Object.values(snap.counters)) assert.equal(typeof v, "number");
  });
});
