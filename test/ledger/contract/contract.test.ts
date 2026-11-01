// CONTRACT suite: the ledger writer against the REAL deployed thq_append_retrieval_event function and triggers, in an isolated
// throwaway PostgreSQL (loopback only, see pg-harness.ts). Nothing here touches Supabase, production, or the network.
// Run: npm run test:ledger-contract
import "../setup.js";
import test, { describe, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { cleanup } from "../setup.js";
import { contractPrerequisites, PgHarness, PgLedgerClient } from "./pg-harness.js";
import { rowHash } from "../../../src/signals/ledger/canonical.js";
import { __setLedgerClientForTests, __setLedgerDepsForTests } from "../../../src/signals/ledger/index.js";
import { __resetLedgerConfigForTests } from "../../../src/signals/ledger/config.js";
import { telemetry } from "../../../src/signals/ledger/telemetry.js";
import { RetrievalRun, type WriterDeps } from "../../../src/signals/ledger/writer.js";
import { serpSearch, trendsSearch } from "../../../src/signals/sources/serp.js";
import { PolicyViolation } from "../../../src/signals/policy.js";
import { ENGINES, REASON_CODES, STAGES, type AppendResult, type LedgerClient, type LedgerEvent } from "../../../src/signals/ledger/types.js";
import { clearFakeSupabase, mockProvider, providerBody, resetArtifacts, restoreProvider, STRICT_CONFIG, STRICT_ENV, useFakeSupabase } from "../support.js";
import { AxiosError } from "axios";

const missing = contractPrerequisites();
const pg = new PgHarness();
const real = new PgLedgerClient(pg);

/** Wraps a client: records every event sent and can pretend chosen event types never reached the database. */
class Tap implements LedgerClient {
  sent: LedgerEvent[] = [];
  drop = new Set<string>();
  constructor(private readonly inner: LedgerClient) {}
  async append(e: Readonly<LedgerEvent>, o: { timeoutMs: number }): Promise<AppendResult> {
    this.sent.push(e as LedgerEvent);
    if (this.drop.has(e.event_type)) return { ok: false, cls: "network" };
    return this.inner.append(e, o);
  }
}

const deps = (client: LedgerClient): WriterDeps => ({
  client, config: STRICT_CONFIG, telemetry, sleep: async () => {}, now: () => new Date(), uuid: () => randomUUID(),
});
const HASH = (n: number): string => n.toString(16).padStart(64, "0");
const count = (where: string): number => Number(pg.sql(`select count(*) from public.thq_retrieval_events where ${where}`));
const issuesFor = (rid: string) => pg.reconciliation().filter(r => r.retrieval_id === rid).map(r => r.issue);

// One throwaway cluster for the whole file.
before(() => { if (!missing) pg.start(); });
after(() => { if (!missing) pg.stop(); cleanup(); });

describe("ledger writer against the deployed function (isolated PostgreSQL)", { skip: missing ?? false, timeout: 280000 }, () => {

  test("L1 every event type and every allowlisted value the writer can produce is accepted by the REAL function", async () => {
    const tap = new Tap(real);
    let expected = 0;
    const attemptWith = async (over: Record<string, unknown>) => {
      const run = new RetrievalRun(deps(tap));
      await run.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: false, ...over } as never);
      assert.equal((await run.summary()).attempt, "acked");
      expected++;
      return run;
    };

    // full flows
    const a = await attemptWith({ queryLength: 256, hasLocation: true, paramNames: ["location", "num", "q"], saveRequested: true, numRequested: 20 });
    await a.providerSucceeded({ engine: "google", resultCount: 100000, servedFromCache: true });
    await a.archived({ engine: "google", artifactUuid: randomUUID(), artifactHash: HASH(1) });
    expected += 2;
    const b = await attemptWith({ queryLength: 1, numRequested: 1 });
    await b.providerSucceeded({ engine: "google", resultCount: 0 });
    expected++;

    // every engine and every trends data type
    for (const engine of ENGINES) await attemptWith({ engine, paramNames: engine === "youtube" ? ["search_query"] : ["q"] });
    for (const dataType of ["TIMESERIES", "GEO_MAP", "RELATED_QUERIES", "RELATED_TOPICS"]) {
      await attemptWith({ engine: "google_trends", dataType, paramNames: ["data_type", "date", "geo", "q"] });
    }

    // every provider error code form
    for (const code of ["http_100", "http_401", "http_429", "http_500", "http_599", "timeout", "network", "provider_error"]) {
      const r = await attemptWith({});
      await r.providerFailed({ engine: "google", errorCode: code });
      expected++;
    }
    // every archive error code, every sanitization stage, and the withholding event
    for (const code of ["archive_write", "archive_mirror", "archive_unknown"] as const) {
      const r = await attemptWith({ saveRequested: true });
      await r.providerSucceeded({ engine: "google", resultCount: 1 });
      await r.archiveFailed({ engine: "google", errorCode: code });
      expected += 2;
    }
    for (const stage of STAGES) {
      const r = await attemptWith({ saveRequested: true });
      await r.providerSucceeded({ engine: "google", resultCount: 1 });
      await r.sanitizationFailed({ engine: "google", stage });
      await r.outputWithheld({ engine: "google" });
      expected += 3;
    }
    // rejections: every reason code at once, engine absent and present, every rejectable field
    const rj = new RetrievalRun(deps(tap));
    await rj.rejected({ field: "q", reasons: [...REASON_CODES] });
    await new RetrievalRun(deps(tap)).rejected({ field: "engine", reasons: ["invalid_format"] });
    for (const field of ["location", "geo", "date", "data_type"] as const) await new RetrievalRun(deps(tap)).rejected({ engine: "google_trends", field, reasons: ["invalid_type"] });
    expected += 6;

    assert.equal(tap.sent.length, expected);
    assert.equal(count("true"), expected, "every event the writer sent is stored: none was refused by the real allowlists");
    assert.equal(telemetry.snapshot().counters.events_failed, 0);
    assert.equal(telemetry.snapshot().counters.validation_failures, 0);
  });

  test("L2 the writer's canonical hash equals the database's for every stored row", () => {
    assert.equal(Number(pg.sql("select count(*) from public.thq_retrieval_events e where e.row_hash <> public.thq_retrieval_event_row_hash(e)")), 0);
    assert.ok(count("true") > 40);
    assert.ok(!pg.reconciliation().some(r => r.issue === "row_hash_mismatch"));
  });

  test("L3 an identical resend is a duplicate; a conflicting payload and a reused seq are conflicts (hard)", async () => {
    const tap = new Tap(real);
    const run = new RetrievalRun(deps(tap));
    await run.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: false });
    const e = tap.sent[0];
    assert.deepEqual(await real.append(e, { timeoutMs: 1000 }), { ok: true, status: "duplicate" });
    const rehash = (x: Omit<LedgerEvent, "row_hash">): LedgerEvent => ({ ...x, row_hash: rowHash(x) });
    const { row_hash: _h, ...body } = e;
    assert.deepEqual(await real.append(rehash({ ...body, query_length: 9 }), { timeoutMs: 1000 }), { ok: false, cls: "conflict" });
    assert.deepEqual(await real.append(rehash({ ...body, event_id: randomUUID() }), { timeoutMs: 1000 }), { ok: false, cls: "seq_conflict" });
    assert.equal(count(`retrieval_id = '${e.retrieval_id}'`), 1, "the stored event was never altered or duplicated");
  });

  test("L4 allowlist violations are refused by the real function and classified as validation (hard)", async () => {
    const tap = new Tap(real);
    const run = new RetrievalRun(deps(tap));
    await run.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: false });
    const { row_hash: _h, ...ok } = tap.sent[0];
    const fresh = (over: Record<string, unknown>) => { const x = { ...ok, event_id: randomUUID(), retrieval_id: randomUUID(), ...over } as Omit<LedgerEvent, "row_hash">; return { ...x, row_hash: rowHash(x) } as LedgerEvent; };
    const bad: [string, LedgerEvent][] = [
      ["writer id with a space", fresh({ writer_id: "Has Space" })],
      ["occurred_at before 2026", fresh({ occurred_at: "2025-01-01T00:00:00.000Z" })],
      ["unknown engine", fresh({ engine: "bing" })],
      ["retention_exception is never writable", fresh({ event_type: "retention_exception", phase: "retention" })],
      ["a client-supplied recorded_at", { ...fresh({}), recorded_at: "2000-01-01T00:00:00Z" } as unknown as LedgerEvent],
      ["an unknown key (query text smuggled in)", { ...fresh({}), q: "SECRET" } as unknown as LedgerEvent],
      ["payload over 8 KiB", fresh({ writer_id: "a".repeat(9000) })],
      ["a wrong row hash", { ...fresh({}), row_hash: HASH(7) }],
      ["a non-uuid event id", { ...fresh({}), event_id: "not-a-uuid" } as LedgerEvent],
    ];
    for (const [name, e] of bad) assert.deepEqual(await real.append(e, { timeoutMs: 1000 }), { ok: false, cls: "validation" }, name);
  });

  test("L5 the service role has no direct INSERT and no access to internal helpers (it only has the function)", () => {
    assert.equal(pg.asServiceRole("insert into public.thq_retrieval_events (event_id) values (gen_random_uuid())").sqlstate, "42501");
    assert.equal(pg.asServiceRole("select public.thq_ledger_reject('x')").sqlstate, "42501");
    assert.equal(pg.asServiceRole("delete from public.thq_retrieval_events").sqlstate, "42501");
  });

  test("L6 interrupted flows leave exactly the discrepancies the reconciliation view is meant to report", async () => {
    // complete flow with its artifact mirrored: nothing to report
    const ok = new RetrievalRun(deps(new Tap(real)));
    await ok.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: true });
    await ok.providerSucceeded({ engine: "google", resultCount: 2 });
    const okArt = randomUUID();
    await ok.archived({ engine: "google", artifactUuid: okArt, artifactHash: HASH(11) });
    pg.mirrorArtifact(okArt, HASH(11));
    assert.deepEqual(issuesFor(ok.retrievalId), []);
    assert.ok(!pg.reconciliation().some(r => r.artifact_uuid === okArt));

    // crashed after the attempt
    const inc = new RetrievalRun(deps(new Tap(real)));
    await inc.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: false });
    assert.deepEqual(issuesFor(inc.retrievalId), ["incomplete_retrieval"]);

    // success recorded, archive requested, nothing after
    const noArch = new RetrievalRun(deps(new Tap(real)));
    await noArch.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: true });
    await noArch.providerSucceeded({ engine: "google", resultCount: 1 });
    assert.deepEqual(issuesFor(noArch.retrievalId), ["archive_outcome_missing"]);

    // REFINEMENT 2: the artifact was stored but its archive event was lost: both discrepancies are reported, and the caller was told
    const lostTap = new Tap(real);
    lostTap.drop.add("archive_succeeded");
    const lost = new RetrievalRun(deps(lostTap));
    await lost.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: true });
    await lost.providerSucceeded({ engine: "google", resultCount: 1 });
    const lostArt = randomUUID();
    await lost.archived({ engine: "google", artifactUuid: lostArt, artifactHash: HASH(12) });
    pg.mirrorArtifact(lostArt, HASH(12));
    assert.deepEqual((await lost.summary()).degraded_codes, ["archive_succeeded:network"]);
    assert.deepEqual(issuesFor(lost.retrievalId), ["archive_outcome_missing"]);
    assert.ok(pg.reconciliation().some(r => r.issue === "artifact_without_ledger" && r.artifact_uuid === lostArt));

    // a lost event in the middle is a visible sequence gap
    const gapTap = new Tap(real);
    gapTap.drop.add("provider_succeeded");
    const gap = new RetrievalRun(deps(gapTap));
    await gap.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: false });
    await gap.providerSucceeded({ engine: "google", resultCount: 1 });
    await gap.outputWithheld({ engine: "google" });
    assert.ok(issuesFor(gap.retrievalId).includes("sequence_gap"));

    // an archive event for an artifact that does not exist
    const orph = new RetrievalRun(deps(new Tap(real)));
    await orph.attempt({ engine: "google", queryLength: 5, hasLocation: false, paramNames: ["q"], saveRequested: true });
    await orph.providerSucceeded({ engine: "google", resultCount: 1 });
    await orph.archived({ engine: "google", artifactUuid: randomUUID(), artifactHash: HASH(13) });
    assert.ok(issuesFor(orph.retrievalId).includes("orphan_artifact_reference"));

    // a rejection alone is complete
    const rej = new RetrievalRun(deps(new Tap(real)));
    await rej.rejected({ field: "q", reasons: ["email"] });
    assert.deepEqual(issuesFor(rej.retrievalId), []);
  });
});

describe("the real lifecycle code against the real function (provider mocked, isolated PostgreSQL)", { skip: missing ?? false, timeout: 280000 }, () => {
  before(() => {
    Object.assign(process.env, STRICT_ENV);
    __resetLedgerConfigForTests();
    __setLedgerClientForTests(new PgLedgerClient(pg));
    __setLedgerDepsForTests({});
    telemetry.reset();
  });
  after(() => { __setLedgerClientForTests(null); });
  afterEach(() => { restoreProvider(); clearFakeSupabase(); });

  test("L7 serp and trends end to end: events as designed, artifacts traceable, and reconciliation has nothing to act on", async () => {
    resetArtifacts();
    const mirror = useFakeSupabase();
    mockProvider(() => ({ data: providerBody() }));
    // L1-L6 share this database: count only what this test adds.
    const countOf = (t: string) => Number(pg.sql(`select count(*) from public.thq_retrieval_events where event_type = '${t}'`));
    const rejectedBefore = countOf("query_rejected"), failedBefore = countOf("provider_failed");

    const saved = await serpSearch({ q: "matcha", location: "Austin, Texas, United States", save: true });
    const trends = await trendsSearch({ q: "matcha", dataType: "TIMESERIES", geo: "US", date: "today 12-m", save: true });
    const plain = await serpSearch({ q: "matcha tea", num: 5 });
    await assert.rejects(serpSearch({ q: "jane.doe@example.com" }), PolicyViolation);
    mockProvider(() => { throw new AxiosError("x", "ERR_BAD_RESPONSE", undefined, {}, { status: 503, data: {}, statusText: "", headers: {}, config: {} as never }); });
    await assert.rejects(serpSearch({ q: "matcha failure" }));

    const types = (rid: unknown) => pg.sql(`select string_agg(event_type, ',' order by seq) from public.thq_retrieval_events where retrieval_id = '${rid}'`);
    assert.equal(types(saved.retrieval_id), "provider_attempt,provider_succeeded,archive_succeeded");
    assert.equal(types(trends.retrieval_id), "provider_attempt,provider_succeeded,archive_succeeded");
    assert.equal(types(plain.retrieval_id), "provider_attempt,provider_succeeded");
    assert.equal(countOf("query_rejected") - rejectedBefore, 1);
    assert.equal(countOf("provider_failed") - failedBefore, 1);
    assert.equal(pg.sql("select error_code from public.thq_retrieval_events where event_type = 'provider_failed' order by recorded_at desc, seq desc limit 1"), "http_503");
    for (const out of [saved, trends]) {
      assert.deepEqual(out.ledger, { mode: "strict", attempt: "acked", degraded: false, degraded_codes: [] });
      const art = out.saved as { uuid: string; hash: string };
      assert.equal(pg.sql(`select artifact_hash from public.thq_retrieval_events where artifact_uuid = '${art.uuid}'`), art.hash);
      assert.ok(mirror.inserted.includes(art.uuid));
      pg.mirrorArtifact(art.uuid, art.hash);
    }
    assert.equal(pg.sql("select count(*) from public.thq_retrieval_events where row_hash <> public.thq_retrieval_event_row_hash(thq_retrieval_events)"), "0");
    const actionable = pg.reconciliation().filter(r => r.issue !== "pre_ledger_artifact" && r.retrieval_id !== null && [saved, trends, plain].some(o => o.retrieval_id === r.retrieval_id));
    assert.deepEqual(actionable, [], "the completed retrievals have no reconciliation issues");
    assert.ok(!pg.sql("select coalesce(string_agg(writer_id || app_version, ','), '') from public.thq_retrieval_events").includes("undefined"));
  });
});
