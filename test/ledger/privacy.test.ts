import "./setup.js";
import test, { describe, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, FAKE_KEY } from "./setup.js";
import { serpSearch, trendsSearch } from "../../src/signals/sources/serp.js";
import { SupabaseLedgerClient } from "../../src/signals/ledger/client.js";
import { telemetry } from "../../src/signals/ledger/telemetry.js";
import { __setLedgerClientForTests } from "../../src/signals/ledger/index.js";
import { redactArtifactForRead } from "../../src/signals/policy.js";
import { CAP, clearFakeSupabase, FakeLedgerDb, mockProvider, providerBody, resetArtifacts, restoreProvider, storedArtifacts, useFakeSupabase, useStrict } from "./support.js";
import fs from "fs";
import path from "path";
import { TEST_VAULT } from "./setup.js";

after(cleanup);

const POISON = "SECRETMARKER sb_secret_abcdefghijklmnop https://serpapi.com/searches/TOKEN/x.json jane.doe@example.com 512-555-0100";
const QUERY = "distinct matcha research phrase";
const LOCATION = "Springfield, Illinois, United States";
// What a database error could carry: must never appear anywhere (responses included).
const DB_POISON = ["SECRETMARKER", "sb_secret_abcdefghijklmnop", "serpapi.com/searches/TOKEN", "jane.doe", "512-555-0100", FAKE_KEY];
// The caller's own query and location: the tool echoes them back to the caller, but they must never reach the ledger, telemetry or logs.
const QUERY_TEXT = ["distinct matcha", "Springfield", "Illinois"];

/** A supabase client whose every rpc reply carries a poisoned message/details/hint, to prove they never travel anywhere. */
function poisonedSupabase(replies: Array<{ code: string; status: number } | "ok">): { sb: SupabaseClient; sent: unknown[] } {
  const sent: unknown[] = [];
  let i = 0;
  const sb = {
    rpc(_name: string, args: { p: unknown }) {
      sent.push(args.p);
      const reply = replies[Math.min(i++, replies.length - 1)];
      const builder = {
        abortSignal() { return builder; },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
          const out = reply === "ok"
            ? { data: "inserted", error: null, status: 200 }
            : { data: null, error: { message: POISON, details: POISON, hint: POISON, code: reply.code }, status: reply.status };
          return Promise.resolve(out).then(res, rej);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { sb, sent };
}

let consoleLines: string[];
const realLog = console.log, realError = console.error, realWarn = console.warn;
beforeEach(() => {
  consoleLines = [];
  console.log = console.error = console.warn = (...a: unknown[]) => { consoleLines.push(a.map(String).join(" ")); };
  resetArtifacts();
});
afterEach(() => {
  console.log = realLog; console.error = realError; console.warn = realWarn;
  restoreProvider(); clearFakeSupabase();
});

const assertClean = (label: string, value: unknown, markers: string[] = [...DB_POISON, ...QUERY_TEXT]): void => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const m of markers) assert.ok(!text.includes(m), `${label} contains ${m}`);
};

describe("nothing sensitive reaches the ledger, telemetry, logs or callers", () => {
  test("P1 poisoned database errors on every outcome: events, telemetry, responses, thrown errors and console stay clean", async () => {
    const { sb, sent } = poisonedSupabase(["ok", { code: "23000", status: 409 }, { code: "23514", status: 400 }, { code: "", status: 503 }, { code: "42501", status: 403 }]);
    useStrict(new FakeLedgerDb());
    __setLedgerClientForTests(new SupabaseLedgerClient(() => sb));
    useFakeSupabase();
    mockProvider(() => ({ data: { ...providerBody(), organic_results: [{ title: "t", link: `${CAP}/leak.json`, snippet: `${FAKE_KEY} password: hunter22` }] } }));
    const out = await serpSearch({ q: QUERY, location: LOCATION, save: true });
    assertClean("response", out, DB_POISON);            // the response echoes the caller's own query by design
    const codes = (out.ledger as { degraded_codes: string[] }).degraded_codes;
    for (const c of codes) assert.match(c, /^[a-z_]+:(conflict|seq_conflict|validation|permission|auth|function_missing|protocol|network|timeout|server|rate_limited|unknown|not_attempted|build_error)$/, `degraded code ${c} is not a closed code`);
    assert.ok(codes.length >= 1, "the poisoned failures were reported as closed codes");
    assertClean("events sent to the database", sent);
    assertClean("telemetry", telemetry.snapshot());
    assertClean("console output", consoleLines.join("\n"));
  });

  test("P2 a poisoned failure of the ATTEMPT refuses with a fixed message that carries none of it", async () => {
    const { sb, sent } = poisonedSupabase([{ code: "23514", status: 400 }]);
    useStrict(new FakeLedgerDb());
    __setLedgerClientForTests(new SupabaseLedgerClient(() => sb));
    const provider = mockProvider(() => ({ data: providerBody() }));
    let caught: unknown;
    try { await serpSearch({ q: QUERY, location: LOCATION }); } catch (e) { caught = e; }
    assert.ok(caught instanceof Error);
    assertClean("thrown error", `${(caught as Error).name}: ${(caught as Error).message}`);
    assert.ok(caught instanceof Error && (caught as { code?: string }).code === "ledger_refused_hard");
    assert.equal(provider.calls(), 0);
    assertClean("events", sent);
    assertClean("console", consoleLines.join("\n"));
  });

  test("P3 every event sent has only allowlisted keys, whatever the flow", async () => {
    const db = new FakeLedgerDb();
    useStrict(db);
    useFakeSupabase();
    mockProvider(() => ({ data: providerBody() }));
    await serpSearch({ q: QUERY, location: LOCATION, save: true });
    await trendsSearch({ q: QUERY, geo: "US", date: "today 12-m", save: true });
    await assert.rejects(serpSearch({ q: "jane.doe@example.com" }));
    const allowed = new Set(["event_id", "retrieval_id", "seq", "phase", "event_type", "schema_version", "provider", "engine", "query_policy", "sanitize_policy",
      "param_names", "query_length", "has_location", "data_type", "num_requested", "save_requested", "rejected_field", "reason_codes", "error_code", "stage",
      "result_count", "served_from_cache", "artifact_uuid", "artifact_hash", "writer_id", "app_version", "occurred_at", "row_hash"]);
    assert.ok(db.sent.length >= 6);
    for (const s of db.sent) for (const k of Object.keys(JSON.parse(s))) assert.ok(allowed.has(k), `unexpected key ${k}`);
    for (const forbidden of ["recorded_at", "txid", "retention_ref", "retention_scope", "affected_rows", "q", "query", "location", "url", "message"]) {
      assert.ok(db.sent.every(s => !(forbidden in JSON.parse(s))), `${forbidden} must never be sent`);
    }
    assertClean("events", db.sent);
  });

  test("P4 only closed event types are ever written (never retention_exception)", async () => {
    const db = new FakeLedgerDb();
    useStrict(db);
    useFakeSupabase();
    mockProvider(() => ({ data: providerBody() }));
    await serpSearch({ q: "matcha", save: true });
    const allowed = new Set(["query_rejected", "provider_attempt", "provider_succeeded", "provider_failed", "archive_succeeded", "archive_failed", "sanitization_failed", "output_withheld"]);
    for (const e of db.all()) assert.ok(allowed.has(e.event_type));
  });
});

describe("Correction 6 protections still hold in strict mode", () => {
  test("P5 capability URLs and credentials stay redacted in the response and the stored artifact; read-time redaction still works", async () => {
    useStrict(new FakeLedgerDb());
    useFakeSupabase();
    mockProvider(() => ({ data: { ...providerBody(), organic_results: [{ title: "t", link: `${CAP}/leak.json`, snippet: `password: hunter22 ${FAKE_KEY}` }] } }));
    const out = await serpSearch({ q: "matcha", save: true });
    const text = JSON.stringify(out);
    for (const leaked of ["FAKETOKEN", "hunter22", FAKE_KEY, "serpapi.com/searches"]) assert.ok(!text.includes(leaked), `response leaked ${leaked}`);
    const [file] = storedArtifacts();
    const stored = fs.readFileSync(path.join(TEST_VAULT, "_artifacts", "house", file), "utf-8");
    for (const leaked of ["FAKETOKEN", "hunter22", FAKE_KEY, "serpapi.com/searches"]) assert.ok(!stored.includes(leaked), `artifact leaked ${leaked}`);
    const legacy = { uuid: "u", title: "t", body: JSON.stringify({ x: `${CAP}/old.json` }), hash: "h", metadata: { kind: "tpig.raw_signal" } };
    assert.ok(!JSON.stringify(redactArtifactForRead(legacy)).includes("FAKETOKEN"));
    assert.equal(legacy.body.includes("FAKETOKEN"), true, "the stored record itself is not mutated");
  });

  test("P6 screening still rejects prohibited queries before anything is sent, in strict mode", async () => {
    const db = new FakeLedgerDb();
    useStrict(db);
    const provider = mockProvider(() => ({ data: providerBody() }));
    for (const q of ["jane.doe@example.com", "4111 1111 1111 1111", "api_key=abc12345", "078-05-1120"]) await assert.rejects(serpSearch({ q }));
    assert.equal(provider.calls(), 0);
    assert.deepEqual(db.all().map(e => e.event_type), ["query_rejected", "query_rejected", "query_rejected", "query_rejected"]);
  });
});
