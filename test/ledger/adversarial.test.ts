import "./setup.js";
import test, { describe, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { cleanup } from "./setup.js";
import { NETWORK_BLOCKED } from "../hermetic.js";
import { getSupabase, __setSupabaseForTests } from "../../src/integrations/supabase.js";
import { resolveLedgerConfig, __resetLedgerConfigForTests } from "../../src/signals/ledger/config.js";
import { __setLedgerClientForTests, __setLedgerDepsForTests, ledgerStartupNotice } from "../../src/signals/ledger/index.js";
import { LedgerUnavailable } from "../../src/signals/ledger/writer.js";
import { serpSearch } from "../../src/signals/sources/serp.js";
import { ATTEMPT, clearFakeSupabase, FakeLedgerDb, makeConfig, mockProvider, newRun, providerBody, resetArtifacts, restoreProvider, STRICT_ENV, useFakeSupabase, useOff, useStrict } from "./support.js";

after(cleanup);
afterEach(() => { restoreProvider(); clearFakeSupabase(); });

describe("provider boundary: no network without an acknowledged attempt", () => {
  test("A1 assertProviderAllowed: strict allows the provider only after THIS run's attempt was acknowledged", async () => {
    const db = new FakeLedgerDb();
    const run = newRun(db);
    assert.throws(() => run.assertProviderAllowed(), (e: unknown) => e instanceof LedgerUnavailable && e.code === "ledger_unavailable");
    await run.attempt(ATTEMPT);
    assert.doesNotThrow(() => run.assertProviderAllowed());
    const down = new FakeLedgerDb();
    down.script.push({ kind: "fail", cls: "network" }, { kind: "fail", cls: "network" }, { kind: "fail", cls: "network" });
    const refused = newRun(down);
    await assert.rejects(refused.attempt(ATTEMPT), LedgerUnavailable);
    assert.throws(() => refused.assertProviderAllowed(), LedgerUnavailable);
    const other = newRun(db);
    assert.throws(() => other.assertProviderAllowed(), LedgerUnavailable);
  });

  test("A2 an invalid strict configuration can never pass the provider gate", () => {
    const run = newRun(new FakeLedgerDb(), { config: resolveLedgerConfig({ ...STRICT_ENV, BLUME_WRITER_ID: "" } as NodeJS.ProcessEnv) });
    assert.throws(() => run.assertProviderAllowed(), (e: unknown) => e instanceof LedgerUnavailable && e.code === "ledger_config_invalid");
  });

  test("A3 off mode keeps the gate open (pre-ledger behaviour)", () => {
    assert.doesNotThrow(() => newRun(new FakeLedgerDb(), { config: makeConfig({ mode: "off" }) }).assertProviderAllowed());
  });

  test("A4 uncertain commits that are never acknowledged refuse the retrieval; the provider is never called; the row exists once", async () => {
    const down = new FakeLedgerDb();
    for (let i = 0; i < 6; i++) down.script.push({ kind: "commit_then_fail", cls: "timeout" });
    useStrict(down);
    useFakeSupabase(); resetArtifacts();
    const provider = mockProvider(() => ({ data: providerBody() }));
    await assert.rejects(serpSearch({ q: "matcha" }), (e: unknown) => e instanceof LedgerUnavailable && e.code === "ledger_unavailable");
    assert.equal(provider.calls(), 0);
    assert.equal(down.rows.size, 1, "identical retries commit once; the lone attempt row is a detectable incomplete retrieval");
  });
});

describe("defence in depth: the fetch gate holds even if attempt() is bypassed", () => {
  test("A4b a regression that lets attempt() resolve without an acknowledgement still cannot reach the provider (serp and trends)", async () => {
    const { RetrievalRun } = await import("../../src/signals/ledger/writer.js");
    const { trendsSearch } = await import("../../src/signals/sources/serp.js");
    const real = RetrievalRun.prototype.attempt;
    RetrievalRun.prototype.attempt = async function () { /* simulates a caller that ignores or skips the acknowledgement */ };
    try {
      useStrict(new FakeLedgerDb());
      useFakeSupabase(); resetArtifacts();
      const provider = mockProvider(() => ({ data: providerBody() }));
      await assert.rejects(serpSearch({ q: "matcha" }), LedgerUnavailable);
      await assert.rejects(trendsSearch({ q: "matcha", dataType: "TIMESERIES", geo: "US", date: "today 12-m" }), LedgerUnavailable);
      assert.equal(provider.calls(), 0, "the structural gate in the provider fetch stopped both");
    } finally { RetrievalRun.prototype.attempt = real; }
  });
});

describe("configuration: strict can only be left by the Founder, never by accident", () => {
  test("A5 every non-off value that is not exactly 'strict' fails CLOSED", () => {
    for (const v of ["Strict", "STRICT", " strict2", "on", "true", "1", "enabled", "OFF", "Off", "none", "false", "0", "disable"]) {
      const c = resolveLedgerConfig({ ...STRICT_ENV, BLUME_LEDGER_MODE: v } as NodeJS.ProcessEnv);
      assert.equal(c.mode, "strict", `"${v}" must not mean off`);
      assert.equal(c.valid, false, `"${v}" must refuse`);
    }
    for (const v of [undefined, "", "off", "  off  "]) assert.equal(resolveLedgerConfig({ BLUME_LEDGER_MODE: v } as NodeJS.ProcessEnv).mode, "off");
  });

  test("A6 once strict is resolved, changing or deleting the setting in the running process changes nothing", async () => {
    useStrict(new FakeLedgerDb());
    const provider = mockProvider(() => ({ data: providerBody() }));
    useFakeSupabase();
    await serpSearch({ q: "matcha one" });
    process.env.BLUME_LEDGER_MODE = "off";
    const second = await serpSearch({ q: "matcha two" });
    assert.equal((second.ledger as { mode: string }).mode, "strict", "still strict: the latch holds");
    delete process.env.BLUME_LEDGER_MODE;
    delete process.env.BLUME_WRITER_ID;
    const third = await serpSearch({ q: "matcha three" });
    assert.equal((third.ledger as { mode: string }).mode, "strict");
    assert.equal(provider.calls(), 3);
  });

  test("A7 writer ids that could smuggle data or collide with ids are refused", () => {
    for (const id of ["UPPER", "has space", "semi;colon", "a".repeat(41), "0123456789abcdef0123456789abcdef", "x-0123456789ABCDEF0123456789abcdef-y", "../etc", "naiveï", "id\nnewline", "id\u0000"]) {
      const c = resolveLedgerConfig({ ...STRICT_ENV, BLUME_WRITER_ID: id } as NodeJS.ProcessEnv);
      assert.equal(c.valid, false, JSON.stringify(id));
    }
    assert.equal(resolveLedgerConfig({ ...STRICT_ENV, BLUME_WRITER_ID: "blume-prod_1" } as NodeJS.ProcessEnv).valid, true);
  });

  test("A8 the startup notice states the resolved mode, and flags NODE_ENV=test, without secrets", () => {
    useOff(null); __resetLedgerConfigForTests();
    assert.match(ledgerStartupNotice(), /mode=off/);
    assert.match(ledgerStartupNotice(), /WARNING NODE_ENV=test/);
    Object.assign(process.env, STRICT_ENV); __resetLedgerConfigForTests();
    const strict = ledgerStartupNotice();
    assert.match(strict, /mode=strict valid writer=blume-test/);
    for (const secret of [STRICT_ENV.SUPABASE_SERVICE_ROLE_KEY, STRICT_ENV.SUPABASE_URL]) assert.ok(!strict.includes(secret));
    process.env.BLUME_WRITER_ID = ""; __resetLedgerConfigForTests();
    assert.match(ledgerStartupNotice(), /mode=strict INVALID reason=writer_id_missing/);
    useOff(null); __resetLedgerConfigForTests();
  });
});

describe("hermetic tests: production credentials and the network cannot enter", () => {
  test("A9 the real axios and fetch are blocked, and no real Supabase client is built from the environment", async () => {
    await assert.rejects(axios.get("https://serpapi.com/search.json"), new RegExp(NETWORK_BLOCKED));
    await assert.rejects(fetch("https://example.invalid/"), new RegExp(NETWORK_BLOCKED));
    process.env.SUPABASE_URL = "https://prod.example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_" + "x".repeat(30);
    __setSupabaseForTests(null);
    try { assert.equal(getSupabase(), null, "credentials in the environment must not build a client under test"); }
    finally { process.env.SUPABASE_URL = ""; process.env.SUPABASE_SERVICE_ROLE_KEY = ""; }
  });

  test("A10 every test seam refuses outside NODE_ENV=test", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.throws(() => __setLedgerClientForTests(null), /only available/);
      assert.throws(() => __setLedgerDepsForTests({}), /only available/);
      assert.throws(() => __resetLedgerConfigForTests(), /only available/);
      assert.throws(() => __setSupabaseForTests(null), /only available/);
    } finally { process.env.NODE_ENV = prev; }
  });
});
