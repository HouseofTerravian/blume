import "./setup.js";
import test, { describe, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./setup.js";
import { serpSearch } from "../../src/signals/sources/serp.js";
import { telemetry } from "../../src/signals/ledger/telemetry.js";
import { LedgerUnavailable } from "../../src/signals/ledger/writer.js";
import type { AppendResult, LedgerEvent } from "../../src/signals/ledger/types.js";
import { ATTEMPT, clearFakeSupabase, FakeLedgerDb, makeConfig, mockProvider, newRun, providerBody, resetArtifacts, restoreProvider, useFakeSupabase, useStrict } from "./support.js";
import { randomUUID } from "crypto";

after(cleanup);
afterEach(() => { restoreProvider(); clearFakeSupabase(); });

/** A fake database with pseudo-random latency, like a real network. */
class JitterDb extends FakeLedgerDb {
  private s = 7;
  private active = 0;
  peak = 0;
  override async append(event: Readonly<LedgerEvent>): Promise<AppendResult> {
    this.active++;
    this.peak = Math.max(this.peak, this.active);
    try {
      this.s = (this.s * 1103515245 + 12345) & 0x7fffffff;
      await new Promise(r => setTimeout(r, this.s % 9));
      return await super.append(event);
    } finally {
      this.active--;
    }
  }
}

describe("concurrent retrievals in one process", () => {
  let db: JitterDb;
  beforeEach(() => { db = new JitterDb(); useStrict(db); useFakeSupabase(); resetArtifacts(); });

  test("N1 50 parallel retrievals: unique ids, contiguous seq per retrieval, and every provider call happened after ITS attempt was recorded", async () => {
    const provider = mockProvider(cfg => {
      const len = String(cfg?.params?.q ?? "").length;
      assert.ok(db.all().some(e => e.event_type === "provider_attempt" && e.query_length === len), `no acknowledged attempt row existed for query length ${len} when its provider call started`);
      return { data: providerBody() };
    });
    const outs = await Promise.all(Array.from({ length: 50 }, (_, i) => serpSearch({ q: "a".repeat(i + 1), save: i % 2 === 0 })));
    assert.equal(provider.calls(), 50);
    const ids = outs.map(o => o.retrieval_id as string);
    assert.equal(new Set(ids).size, 50);
    for (const [i, o] of outs.entries()) {
      const rid = o.retrieval_id as string;
      const seqs = db.seqsOf(rid);
      assert.deepEqual(seqs, seqs.map((_, k) => k + 1), `retrieval ${i} has contiguous seq`);
      assert.deepEqual(db.typesOf(rid), i % 2 === 0 ? ["provider_attempt", "provider_succeeded", "archive_succeeded"] : ["provider_attempt", "provider_succeeded"]);
      const mine = db.sent.map(s => JSON.parse(s)).filter(e => e.retrieval_id === rid).map(e => e.seq);
      assert.deepEqual(mine, [...mine].sort((a, b) => a - b), "events of one retrieval arrived in order");
    }
    assert.ok(db.peak > 1, "the retrievals genuinely overlapped");
    assert.equal(telemetry.snapshot().counters.degraded_responses, 0);
  });

  test("N2 ordering inside a retrieval holds even when the database is slower for earlier events", async () => {
    let n = 0;
    db.delayMs = 0;
    const slowFirst = new (class extends FakeLedgerDb {
      override async append(e: Readonly<LedgerEvent>): Promise<AppendResult> {
        await new Promise(r => setTimeout(r, n++ === 0 ? 40 : 1));
        return super.append(e);
      }
    })();
    useStrict(slowFirst);
    mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha", save: true });
    assert.deepEqual(slowFirst.typesOf(out.retrieval_id as string), ["provider_attempt", "provider_succeeded", "archive_succeeded"]);
    assert.deepEqual(slowFirst.sent.map(s => JSON.parse(s).seq), [1, 2, 3]);
  });

  test("N3 the same event sent twice at once: one is inserted, the other duplicate, one row", async () => {
    const run = newRun(db);
    await run.attempt(ATTEMPT);
    const stored = db.all()[0];
    const [a, b] = await Promise.all([db.append(stored), db.append(stored)]);
    assert.deepEqual([a, b].map(r => (r.ok ? r.status : r.cls)).sort(), ["duplicate", "duplicate"], "the row already exists, so both are duplicates");
    const fresh = new FakeLedgerDb();
    const [c, d] = await Promise.all([fresh.append(stored), fresh.append(stored)]);
    assert.deepEqual([c, d].map(r => (r.ok ? r.status : r.cls)).sort(), ["duplicate", "inserted"]);
    assert.equal(fresh.rows.size, 1);
  });

  test("N4 two writers with different writer ids share the database without interfering", async () => {
    const shared = new JitterDb();
    const a = Array.from({ length: 10 }, () => newRun(shared, { config: makeConfig({ writerId: "blume-a" }), uuid: () => randomUUID() }));
    const b = Array.from({ length: 10 }, () => newRun(shared, { config: makeConfig({ writerId: "blume-b" }), uuid: () => randomUUID() }));
    await Promise.all([...a, ...b].map(async r => { await r.attempt(ATTEMPT); await r.providerSucceeded({ engine: "google", resultCount: 1 }); }));
    assert.equal(shared.rows.size, 40);
    assert.equal(shared.all().filter(e => e.writer_id === "blume-a").length, 20);
    assert.equal(shared.all().filter(e => e.writer_id === "blume-b").length, 20);
    for (const rid of shared.retrievalIds()) assert.deepEqual(shared.seqsOf(rid), [1, 2]);
  });

  test("N5 a late acknowledgement after the writer timed out and retried is harmless", async () => {
    let calls = 0;
    const late = new (class extends FakeLedgerDb {
      override async append(e: Readonly<LedgerEvent>): Promise<AppendResult> {
        if (calls++ === 0) { await new Promise(r => setTimeout(r, 450)); return super.append(e); }   // first call answers long after the deadline
        return super.append(e);
      }
    })();
    const run = newRun(late, { config: makeConfig({ attempt: { timeoutMs: 30, retries: 2, backoffMs: [1, 1] } }) });
    await run.attempt(ATTEMPT);
    assert.equal((await run.summary()).attempt, "acked");
    await new Promise(r => setTimeout(r, 600));                  // let the abandoned first call finish
    assert.equal(late.rows.size, 1, "one row despite two sends");
    assert.equal(new Set(late.sent).size, 1, "both sends were identical");
  });

  test("N6 under random database failures the invariant holds: no provider call without a recorded attempt", async () => {
    let s = 99;
    const flaky = new (class extends FakeLedgerDb {
      override async append(e: Readonly<LedgerEvent>): Promise<AppendResult> {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const roll = s % 10;
        if (roll < 3) { this.script.push({ kind: "fail", cls: "network" }); }
        else if (roll === 3) { this.script.push({ kind: "commit_then_fail", cls: "timeout" }); }
        return super.append(e);
      }
    })();
    useStrict(flaky);
    let refused = 0, completed = 0;
    const provider = mockProvider(cfg => {
      const len = String(cfg?.params?.q ?? "").length;
      assert.ok(flaky.all().some(e => e.event_type === "provider_attempt" && e.query_length === len), "provider called without a recorded attempt");
      return { data: providerBody() };
    });
    await Promise.all(Array.from({ length: 40 }, async (_, i) => {
      try { await serpSearch({ q: "b".repeat(i + 1) }); completed++; } catch (e) { assert.ok(e instanceof LedgerUnavailable); refused++; }
    }));
    assert.equal(completed + refused, 40);
    assert.equal(provider.calls(), completed, "the provider was called exactly for the retrievals that were allowed");
    assert.ok(completed > 0);
  });
});
