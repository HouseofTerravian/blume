import "./setup.js";
import test, { describe, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { AxiosError } from "axios";
import { cleanup, TEST_VAULT } from "./setup.js";
import { serpSearch, trendsSearch } from "../../src/signals/sources/serp.js";
import { PolicyViolation, ProviderError } from "../../src/signals/policy.js";
import { clearFakeSupabase, FakeLedgerDb, legacyLogExists, mockProvider, providerBody, resetArtifacts, resetLegacyLog, restoreProvider, storedArtifacts, useFakeSupabase, useOff } from "./support.js";

after(cleanup);

let db: FakeLedgerDb;
beforeEach(() => { db = new FakeLedgerDb(); useOff(db); useFakeSupabase(); resetArtifacts(); resetLegacyLog(); });
afterEach(() => { restoreProvider(); clearFakeSupabase(); });

const legacyEvents = (): { event: string }[] =>
  fs.readFileSync(path.join(TEST_VAULT, "_signals", "retrieval-log.jsonl"), "utf-8").trim().split("\n").map(l => JSON.parse(l));

describe("BLUME_LEDGER_MODE=off (the default) is inert", () => {
  test("O1 the ledger client is never called; the response has no ledger field; the legacy log is still written", async () => {
    const provider = mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha", save: true });
    assert.equal(db.sent.length, 0);
    assert.equal(provider.calls(), 1);
    assert.equal("ledger" in out, false);
    assert.ok(typeof out.retrieval_id === "string");
    assert.equal(legacyLogExists(), true);
    assert.deepEqual(legacyEvents().map(e => e.event), ["retrieved", "save_ok"]);
  });

  test("O2 trends behaves the same way", async () => {
    mockProvider(() => ({ data: providerBody() }));
    const out = await trendsSearch({ q: "matcha" });
    assert.equal(db.sent.length, 0);
    assert.equal("ledger" in out, false);
    assert.deepEqual(legacyEvents().map(e => e.event), ["retrieved"]);
  });

  test("O3 a rejection is logged to the legacy file and not to the ledger", async () => {
    mockProvider(() => ({ data: providerBody() }));
    await assert.rejects(serpSearch({ q: "jane.doe@example.com" }), PolicyViolation);
    assert.equal(db.sent.length, 0);
    assert.deepEqual(legacyEvents().map(e => e.event), ["query_rejected"]);
  });

  test("O4 a provider failure propagates as before and is logged to the legacy file only", async () => {
    mockProvider(() => { throw new AxiosError("x", "ERR_BAD_RESPONSE", undefined, {}, { status: 500, data: {}, statusText: "", headers: {}, config: {} as never }); });
    await assert.rejects(serpSearch({ q: "matcha" }), ProviderError);
    assert.equal(db.sent.length, 0);
    assert.deepEqual(legacyEvents().map(e => e.event), ["retrieval_failed"]);
  });

  test("O5 a database outage cannot affect off mode at all", async () => {
    db.down = true;
    mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha", save: true });
    assert.equal((out.results as unknown[]).length, 2);
    assert.equal(db.sent.length, 0);
  });

  test("O6 an explicit 'off' behaves exactly like an unset mode", async () => {
    process.env.BLUME_LEDGER_MODE = "off";
    useOff(db);
    process.env.BLUME_LEDGER_MODE = "off";
    mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha" });
    assert.equal("ledger" in out, false);
    assert.equal(db.sent.length, 0);
    delete process.env.BLUME_LEDGER_MODE;
  });

  test("O7 raw-signal artifacts keep their guards and now also carry the retrieval id", async () => {
    mockProvider(() => ({ data: providerBody() }));
    const out = await serpSearch({ q: "matcha", save: true });
    const [file] = storedArtifacts();
    const stored = JSON.parse(fs.readFileSync(path.join(TEST_VAULT, "_artifacts", "house", file), "utf-8"));
    assert.equal(stored.metadata.kind, "tpig.raw_signal");
    assert.equal(stored.metadata.sanitization_policy, "tpig-sanitize-2");
    assert.equal(stored.metadata.retrieval_id, out.retrieval_id);
  });
});
