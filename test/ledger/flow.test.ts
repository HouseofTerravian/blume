import "./setup.js";
import test, { describe, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { AxiosError } from "axios";
import { cleanup, FAKE_KEY, TEST_VAULT } from "./setup.js";
import { serpSearch, trendsSearch } from "../../src/signals/sources/serp.js";
import { __injectRedactionFaultForTests, PolicyViolation, ProviderError } from "../../src/signals/policy.js";
import { LedgerUnavailable } from "../../src/signals/ledger/writer.js";
import { telemetry } from "../../src/signals/ledger/telemetry.js";
import { CAP, clearFakeSupabase, FakeLedgerDb, legacyLogExists, mockProvider, providerBody, resetArtifacts, resetLegacyLog, restoreProvider, storedArtifacts, useFakeSupabase, useStrict } from "./support.js";
import type { LedgerEvent } from "../../src/signals/ledger/types.js";

after(cleanup);

let db: FakeLedgerDb;
beforeEach(() => {
  db = new FakeLedgerDb();
  useStrict(db);
  useFakeSupabase();
  resetArtifacts();
  resetLegacyLog();
});
afterEach(() => {
  restoreProvider();
  clearFakeSupabase();
  __injectRedactionFaultForTests(false);
});

const types = (out: Record<string, unknown>): string[] => db.typesOf(out.retrieval_id as string);
const events = (rid: string): LedgerEvent[] => db.all().filter(e => e.retrieval_id === rid).sort((a, b) => a.seq - b.seq);
const axiosFailure = (status: number | undefined, code?: string, data?: unknown): AxiosError =>
  new AxiosError(`failed ${FAKE_KEY}`, code, { url: `https://serpapi.com/search.json?api_key=${FAKE_KEY}` } as never, {},
    status === undefined ? undefined : { status, data, statusText: "", headers: {}, config: {} as never });

/** What a reconciliation view would call artifact_without_ledger: stored raw signals with no archive_succeeded event. */
function artifactsWithoutLedger(): string[] {
  const dir = path.join(TEST_VAULT, "_artifacts", "house");
  if (!fs.existsSync(dir)) return [];
  const recorded = new Set(db.all().filter(e => e.event_type === "archive_succeeded").map(e => e.artifact_uuid));
  return fs.readdirSync(dir).map(f => f.replace(/\.json$/, "")).filter(u => !recorded.has(u));
}

describe("strict lifecycle: normal flows", () => {
  test("F1 not saved: attempt then succeeded; typed metadata only; the attempt precedes the provider call", async () => {
    const order: string[] = [];
    const provider = mockProvider(() => { order.push(`provider(rows=${db.rows.size})`); return { data: providerBody() }; });
    const out = await serpSearch({ q: "matcha latte recipes" });
    assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded"]);
    assert.equal(provider.calls(), 1);
    assert.deepEqual(order, ["provider(rows=1)"], "the attempt row existed BEFORE the provider was called");
    const [attempt, succeeded] = events(out.retrieval_id as string);
    assert.deepEqual([attempt.param_names, attempt.query_length, attempt.has_location, attempt.save_requested, attempt.num_requested, attempt.engine],
      [["num", "q"], "matcha latte recipes".length, false, false, 10, "google"]);
    assert.equal(succeeded.result_count, 2);
    assert.deepEqual(out.ledger, { mode: "strict", attempt: "acked", degraded: false, degraded_codes: [] });
    assert.equal((out.results as unknown[]).length, 2);
    assert.ok(!JSON.stringify(out).includes("FAKETOKEN") && !JSON.stringify(out).includes(FAKE_KEY));
  });

  test("F2 saved: archive_succeeded carries the stored artifact's uuid and hash; the artifact links back by retrieval_id", async () => {
    const fake = useFakeSupabase();
    mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha", location: "Austin, Texas, United States", save: true });
    assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded", "archive_succeeded"]);
    const [attempt, , archive] = events(out.retrieval_id as string);
    assert.deepEqual([attempt.has_location, attempt.save_requested, attempt.param_names], [true, true, ["location", "num", "q"]]);
    const saved = out.saved as { uuid: string; hash: string };
    assert.deepEqual([archive.artifact_uuid, archive.artifact_hash, archive.sanitize_policy], [saved.uuid, saved.hash, "tpig-sanitize-2"]);
    assert.ok(fake.inserted.includes(saved.uuid), "the artifact was mirrored");
    const stored = JSON.parse(fs.readFileSync(path.join(TEST_VAULT, "_artifacts", "house", `${saved.uuid}.json`), "utf-8"));
    assert.equal(stored.metadata.retrieval_id, out.retrieval_id, "the artifact carries its retrieval id");
    assert.equal((out.ledger as { degraded: boolean }).degraded, false);
    assert.deepEqual(artifactsWithoutLedger(), []);
  });

  test("F3 trends: data_type and date/geo are recorded as parameter NAMES; result_count of an object result is 1", async () => {
    mockProvider(() => ({ data: providerBody() }));
    const out = await trendsSearch({ q: "matcha", dataType: "TIMESERIES", geo: "US-TX", date: "today 12-m", save: true });
    assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded", "archive_succeeded"]);
    const [attempt, succeeded] = events(out.retrieval_id as string);
    assert.deepEqual([attempt.engine, attempt.data_type, attempt.param_names, attempt.has_location, attempt.num_requested],
      ["google_trends", "TIMESERIES", ["data_type", "date", "geo", "q"], false, undefined]);
    assert.equal(succeeded.result_count, 1);
  });

  test("F4 the legacy JSONL log is not written in strict mode, and no event holds query text or location", async () => {
    mockProvider(() => ({ data: providerBody() }));
    await serpSearch({ q: "very specific matcha phrase", location: "Springfield, Illinois, United States", save: true });
    await assert.rejects(serpSearch({ q: "mail jane.doe@example.com" }), PolicyViolation);
    assert.equal(legacyLogExists(), false, "nothing is written to the local log in strict mode");
    const text = JSON.stringify(db.all());
    for (const m of ["very specific", "matcha phrase", "Springfield", "Illinois", "jane.doe", "example.com"]) assert.ok(!text.includes(m), `ledger leaked ${m}`);
  });
});

describe("strict lifecycle: provider failures", () => {
  const cases: [string, () => unknown, string][] = [
    ["HTTP 401", () => { throw axiosFailure(401, "ERR_BAD_REQUEST", { error: "Invalid API key" }); }, "http_401"],
    ["HTTP 429", () => { throw axiosFailure(429, "ERR_BAD_REQUEST", { error: "Your account has run out of searches." }); }, "http_429"],
    ["HTTP 500", () => { throw axiosFailure(500, "ERR_BAD_RESPONSE"); }, "http_500"],
    ["a timeout", () => { throw axiosFailure(undefined, "ECONNABORTED"); }, "timeout"],
    ["a network failure", () => { throw axiosFailure(undefined, "ERR_NETWORK"); }, "network"],
    ["HTTP 200 with an error body", () => ({ data: { error: "Something went wrong" } }), "provider_error"],
    ["a non-HTTP exception", () => { throw new Error(`boom ${FAKE_KEY}`); }, "provider_error"],
  ];
  for (const [name, handler, code] of cases) {
    test(`F5 ${name} -> provider_failed(${code}); no archive; the safe error is rethrown`, async () => {
      const provider = mockProvider(handler);
      let caught: unknown;
      try { await serpSearch({ q: "matcha", save: true }); } catch (e) { caught = e; }
      assert.ok(caught instanceof ProviderError, "a ProviderError reaches the caller");
      assert.equal((caught as ProviderError).ledgerCode, code);
      assert.ok(!(caught as Error).message.includes(FAKE_KEY));
      assert.equal(provider.calls(), 1, "the provider is called once and never retried");
      const rid = db.retrievalIds()[0];
      assert.deepEqual(db.typesOf(rid), ["provider_attempt", "provider_failed"]);
      assert.equal(events(rid)[1].error_code, code);
      assert.deepEqual(storedArtifacts(), []);
    });
  }

  test("F6 trends provider failure is recorded the same way", async () => {
    mockProvider(() => { throw axiosFailure(503, "ERR_BAD_RESPONSE"); });
    await assert.rejects(trendsSearch({ q: "matcha" }), ProviderError);
    assert.deepEqual(db.typesOf(db.retrievalIds()[0]), ["provider_attempt", "provider_failed"]);
    assert.equal(events(db.retrievalIds()[0])[1].error_code, "http_503");
  });
});

describe("strict lifecycle: screening rejections", () => {
  test("F7 a prohibited query records only query_rejected with codes; the provider is never called", async () => {
    const provider = mockProvider(() => ({ data: providerBody() }));
    await assert.rejects(serpSearch({ q: "call me 512-555-0100 or jane.doe@example.com" }), PolicyViolation);
    assert.equal(provider.calls(), 0);
    const [e] = db.all();
    assert.equal(db.rows.size, 1);
    assert.deepEqual([e.event_type, e.rejected_field, e.reason_codes, e.engine, e.query_policy], ["query_rejected", "q", ["email", "phone"], "google", "tpig-query-policy-1"]);
    assert.ok(!JSON.stringify(e).includes("512") && !JSON.stringify(e).includes("jane"));
    assert.equal(telemetry.snapshot().counters.rejections_recorded, 1);
  });

  test("F8 an invalid engine is rejected without an engine; a bad location and a bad geo name their field", async () => {
    mockProvider(() => ({ data: providerBody() }));
    await assert.rejects(serpSearch({ q: "matcha", engine: "bing" }), PolicyViolation);
    await assert.rejects(serpSearch({ q: "matcha", location: "123 main street" }), PolicyViolation);
    await assert.rejects(trendsSearch({ q: "matcha", geo: "not a region" }), PolicyViolation);
    const rows = db.all().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const byField = Object.fromEntries(rows.map(r => [r.rejected_field, r]));
    assert.equal(byField.engine.engine, undefined);
    assert.equal(byField.location.engine, "google");
    assert.equal(byField.geo.engine, "google_trends");
    assert.deepEqual(byField.geo.reason_codes, ["invalid_format"]);
  });

  test("F9 a rejection whose audit event cannot be written is still returned as a rejection (and counted as lost)", async () => {
    db.down = true;
    await assert.rejects(serpSearch({ q: "jane.doe@example.com" }), PolicyViolation);
    assert.equal(telemetry.snapshot().counters.rejections_lost, 1);
  });
});

describe("strict lifecycle: redaction failures", () => {
  test("F10 saved and unverifiable: sanitization_failed then output_withheld, nothing stored, no data returned", async () => {
    mockProvider(() => ({ data: { ...providerBody(), note: `leaked ${FAKE_KEY}` } }));
    __injectRedactionFaultForTests(true);
    const out = await serpSearch({ q: "matcha", save: true });
    __injectRedactionFaultForTests(false);
    assert.equal(out.withheld, true);
    assert.equal(out.results, undefined);
    assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded", "sanitization_failed", "output_withheld"]);
    const ev = events(out.retrieval_id as string);
    assert.ok(["params", "response", "title", "archive-body"].includes(ev[2].stage as string));
    assert.equal(ev[3].stage, "output");
    assert.deepEqual(storedArtifacts(), []);
    assert.ok(!JSON.stringify(out).includes(FAKE_KEY));
  });

  test("F11 not saved and unverifiable: the output stage is recorded", async () => {
    mockProvider(() => ({ data: { ...providerBody(), note: `leaked ${FAKE_KEY}` } }));
    __injectRedactionFaultForTests(true);
    const out = await trendsSearch({ q: "matcha" });
    __injectRedactionFaultForTests(false);
    assert.equal(out.withheld, true);
    assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded", "sanitization_failed", "output_withheld"]);
    assert.equal(events(out.retrieval_id as string)[2].stage, "output");
  });
});

describe("strict lifecycle: partial archives", () => {
  test("F12 the local write fails: archive_failed(archive_write); results are still returned", async () => {
    fs.writeFileSync(path.join(TEST_VAULT, "_artifacts"), "a file where a directory is expected");   // makes mkdir/write fail
    mockProvider(() => ({ data: providerBody() }));
    try {
      const out = await serpSearch({ q: "matcha", save: true });
      assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded", "archive_failed"]);
      assert.equal(events(out.retrieval_id as string)[2].error_code, "archive_write");
      assert.equal(out.saved, null);
      assert.ok(typeof out.save_error === "string");
      assert.equal((out.results as unknown[]).length, 2);
      assert.equal((out.ledger as { degraded: boolean }).degraded, false, "the failure was recorded, so the ledger is complete");
    } finally {
      fs.rmSync(path.join(TEST_VAULT, "_artifacts"), { force: true });
    }
  });

  test("F13 the live mirror fails: archive_failed(archive_mirror); the local copy is preserved", async () => {
    useFakeSupabase({ failMirror: true });
    const errors: unknown[][] = [];
    const realError = console.error;
    console.error = (...a: unknown[]) => { errors.push(a); };
    mockProvider(() => ({ data: providerBody() }));
    try {
      const out = await serpSearch({ q: "matcha", save: true });
      assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded", "archive_failed"]);
      assert.equal(events(out.retrieval_id as string)[2].error_code, "archive_mirror");
      assert.equal(storedArtifacts().length, 1, "the local copy exists");
    } finally {
      console.error = realError;
    }
  });
});

describe("strict lifecycle: ledger outages", () => {
  test("F14 the ledger is down at the attempt: LedgerUnavailable and the provider is NEVER called", async () => {
    db.down = true;
    const provider = mockProvider(() => ({ data: providerBody() }));
    await assert.rejects(serpSearch({ q: "matcha", save: true }), (e: unknown) => e instanceof LedgerUnavailable && e.code === "ledger_unavailable");
    await assert.rejects(trendsSearch({ q: "matcha" }), LedgerUnavailable);
    assert.equal(provider.calls(), 0);
    assert.deepEqual(storedArtifacts(), []);
    assert.equal(legacyLogExists(), false);
  });

  test("F15 the attempt is acknowledged but outcomes are not: results are returned flagged ledger_degraded", async () => {
    db.failTypes.set("provider_succeeded", "network");
    db.failTypes.set("archive_succeeded", "server");
    mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha", save: true });
    assert.equal((out.results as unknown[]).length, 2);
    assert.deepEqual(out.ledger, {
      mode: "strict", attempt: "acked", degraded: true, degraded_codes: ["archive_succeeded:server", "provider_succeeded:network"],
    });
  });

  test("F16 refinement: an archived artifact whose archive event was lost remains DETECTABLE (nothing is hidden or repaired)", async () => {
    db.failTypes.set("archive_succeeded", "network");
    mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha", save: true });
    const saved = out.saved as { uuid: string };
    assert.ok(saved?.uuid, "the artifact was archived (paid-for data is not discarded)");
    assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded"], "no archive event, and no compensating event was invented");
    assert.deepEqual(artifactsWithoutLedger(), [saved.uuid], "a reconciliation would report artifact_without_ledger for it");
    assert.deepEqual((out.ledger as { degraded_codes: string[] }).degraded_codes, ["archive_succeeded:network"], "the caller is told");
    const stored = JSON.parse(fs.readFileSync(path.join(TEST_VAULT, "_artifacts", "house", `${saved.uuid}.json`), "utf-8"));
    assert.equal(stored.metadata.retrieval_id, out.retrieval_id, "and the artifact itself names the retrieval that produced it");
    assert.deepEqual(db.seqsOf(out.retrieval_id as string), [1, 2], "the sequence shows what was recorded, with no filler");
  });

  test("F17 a hard failure while recording the attempt (schema drift) refuses without calling the provider", async () => {
    db.script = [{ kind: "fail", cls: "validation" }];
    const provider = mockProvider(() => ({ data: providerBody() }));
    await assert.rejects(serpSearch({ q: "matcha" }), (e: unknown) => e instanceof LedgerUnavailable && e.code === "ledger_refused_hard");
    assert.equal(provider.calls(), 0);
  });

  test("F18 a lost acknowledgement does not duplicate the attempt and does not block the retrieval", async () => {
    db.script = [{ kind: "commit_then_fail", cls: "timeout" }];
    const provider = mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha" });
    assert.equal(provider.calls(), 1);
    assert.deepEqual(types(out), ["provider_attempt", "provider_succeeded"], "exactly one attempt row");
  });
});

describe("strict mode never falls back to off", () => {
  test("F19 a long outage refuses every call and the mode stays strict; recovery is just the ledger coming back", async () => {
    const provider = mockProvider(() => ({ data: providerBody() }));
    db.down = true;
    for (let i = 0; i < 4; i++) await assert.rejects(serpSearch({ q: "matcha" }), LedgerUnavailable);
    assert.equal(provider.calls(), 0);
    assert.equal(legacyLogExists(), false, "no JSONL fallback appeared either");
    db.down = false;
    const out = await serpSearch({ q: "matcha" });
    assert.equal((out.ledger as { mode: string }).mode, "strict");
    assert.equal(provider.calls(), 1);
  });

  test("F20 invalid strict configuration refuses before any provider call (writer id missing, bad mode value)", async () => {
    const provider = mockProvider(() => ({ data: providerBody() }));
    useStrict(db, { BLUME_WRITER_ID: "" });
    await assert.rejects(serpSearch({ q: "matcha" }), (e: unknown) => e instanceof LedgerUnavailable && e.code === "ledger_config_invalid");
    useStrict(db, { BLUME_LEDGER_MODE: "on" });
    await assert.rejects(trendsSearch({ q: "matcha" }), (e: unknown) => e instanceof LedgerUnavailable && e.code === "ledger_config_invalid");
    assert.equal(provider.calls(), 0);
    assert.equal(db.sent.length, 0);
  });
});
