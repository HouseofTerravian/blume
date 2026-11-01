import "./setup.js";
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./setup.js";
import { __resetLedgerConfigForTests, getLedgerConfig, resolveLedgerConfig } from "../../src/signals/ledger/config.js";
import { STRICT_ENV } from "./support.js";

after(cleanup);

const env = (over: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({ ...STRICT_ENV, ...over }) as NodeJS.ProcessEnv;

describe("ledger mode resolution", () => {
  test("G1 unset and 'off' are off; nothing else about the environment matters", () => {
    for (const mode of [undefined, "", "off", "  off  "]) {
      const c = resolveLedgerConfig({ BLUME_LEDGER_MODE: mode } as NodeJS.ProcessEnv);
      assert.equal(c.mode, "off"); assert.equal(c.valid, true);
    }
  });

  test("G2 strict with everything correct is valid and carries the writer id", () => {
    const c = resolveLedgerConfig(env());
    assert.equal(c.mode, "strict"); assert.equal(c.valid, true); assert.equal(c.reason, null); assert.equal(c.writerId, "blume-test");
    assert.deepEqual([c.attempt.timeoutMs, c.attempt.retries, c.outcome.timeoutMs, c.outcome.retries], [5000, 2, 3000, 1]);
  });

  test("G3 anything that is not exactly 'off' or 'strict' is strict AND invalid: it never degrades to off", () => {
    for (const mode of ["on", "Strict", "STRICT", "true", "1", "disabled", "off ", "strict,off", "none"]) {
      const c = resolveLedgerConfig(env({ BLUME_LEDGER_MODE: mode }));
      if (mode.trim() === "off") { assert.equal(c.mode, "off"); continue; }
      assert.equal(c.mode, "strict", `mode ${JSON.stringify(mode)} must not become off`);
      assert.equal(c.valid, false); assert.equal(c.reason, "mode_invalid");
    }
  });

  test("G4 strict requires a valid writer id", () => {
    assert.equal(resolveLedgerConfig(env({ BLUME_WRITER_ID: undefined })).reason, "writer_id_missing");
    assert.equal(resolveLedgerConfig(env({ BLUME_WRITER_ID: "   " })).reason, "writer_id_missing");
    for (const bad of ["Has Space", "UPPER", "a/b", "x".repeat(41), "a".repeat(32), "host.example.com"]) {
      assert.equal(resolveLedgerConfig(env({ BLUME_WRITER_ID: bad })).reason, "writer_id_invalid", bad);
    }
    assert.equal(resolveLedgerConfig(env({ BLUME_WRITER_ID: "blume-desktop_2" })).valid, true);
  });

  test("G5 strict requires database credentials", () => {
    assert.equal(resolveLedgerConfig(env({ SUPABASE_URL: "" })).reason, "credentials_missing");
    assert.equal(resolveLedgerConfig(env({ SUPABASE_SERVICE_ROLE_KEY: undefined })).reason, "credentials_missing");
  });

  test("G6 numeric settings are bounded and invalid values refuse instead of falling back", () => {
    assert.equal(resolveLedgerConfig(env({ BLUME_LEDGER_ATTEMPT_TIMEOUT_MS: "499" })).reason, "numeric_invalid");
    assert.equal(resolveLedgerConfig(env({ BLUME_LEDGER_ATTEMPT_TIMEOUT_MS: "30001" })).reason, "numeric_invalid");
    assert.equal(resolveLedgerConfig(env({ BLUME_LEDGER_ATTEMPT_RETRIES: "6" })).reason, "numeric_invalid");
    assert.equal(resolveLedgerConfig(env({ BLUME_LEDGER_OUTCOME_RETRIES: "abc" })).reason, "numeric_invalid");
    assert.equal(resolveLedgerConfig(env({ BLUME_LEDGER_OUTCOME_TIMEOUT_MS: "-5" })).reason, "numeric_invalid");
    const ok = resolveLedgerConfig(env({ BLUME_LEDGER_ATTEMPT_TIMEOUT_MS: "800", BLUME_LEDGER_ATTEMPT_RETRIES: "0" }));
    assert.deepEqual([ok.valid, ok.attempt.timeoutMs, ok.attempt.retries], [true, 800, 0]);
    // numeric settings are ignored in off mode
    assert.equal(resolveLedgerConfig({ BLUME_LEDGER_MODE: "off", BLUME_LEDGER_ATTEMPT_TIMEOUT_MS: "abc" } as NodeJS.ProcessEnv).valid, true);
  });
});

describe("no automatic strict-to-off fallback", () => {
  test("G7 once strict is resolved in a process it is latched: changing the environment cannot turn it off", () => {
    Object.assign(process.env, STRICT_ENV);
    __resetLedgerConfigForTests();
    assert.equal(getLedgerConfig().mode, "strict");
    delete process.env.BLUME_LEDGER_MODE;
    process.env.BLUME_LEDGER_MODE = "off";
    assert.equal(getLedgerConfig().mode, "strict", "a runtime change of the setting must not downgrade a running strict process");
    delete process.env.BLUME_WRITER_ID;
    assert.equal(getLedgerConfig().valid, true, "nor can a later environment change invalidate or alter the latched configuration");
  });

  test("G8 an invalid strict configuration stays strict and invalid when the environment later looks fine", () => {
    Object.assign(process.env, STRICT_ENV, { BLUME_WRITER_ID: "" });
    __resetLedgerConfigForTests();
    assert.deepEqual([getLedgerConfig().mode, getLedgerConfig().valid, getLedgerConfig().reason], ["strict", false, "writer_id_missing"]);
    process.env.BLUME_WRITER_ID = "blume-test";
    assert.equal(getLedgerConfig().valid, false, "fixing the environment needs a restart; the code never re-evaluates by itself");
  });

  test("G9 the test seam refuses to run outside NODE_ENV=test", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try { assert.throws(() => __resetLedgerConfigForTests()); } finally { process.env.NODE_ENV = prev; }
  });
});
