import "./setup.js";
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./setup.js";
import {
  buildArchiveFailed, buildArchiveSucceeded, buildOutputWithheld, buildProviderAttempt, buildProviderFailed,
  buildProviderSucceeded, buildQueryRejected, buildSanitizationFailed, LedgerBuildError, type EventContext,
} from "../../src/signals/ledger/events.js";
import { rowHash } from "../../src/signals/ledger/canonical.js";
import { ENGINES, REASON_CODES, STAGES } from "../../src/signals/ledger/types.js";

after(cleanup);

function ctx(over: Partial<EventContext> = {}): EventContext {
  let seq = 0;
  let n = 0;
  return {
    retrievalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    writerId: "blume-test",
    appVersion: "1.0.0",
    nextSeq: () => ++seq,
    now: () => new Date("2026-11-01T12:00:00.000Z"),
    uuid: () => `bbbbbbbb-bbbb-4bbb-8bbb-${String(++n).padStart(12, "0")}`,
    ...over,
  };
}
const POLICY = "tpig-query-policy-1";
const SPOLICY = "tpig-sanitize-2";
const HASH = "a".repeat(64);
const ART = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const fail = (fn: () => unknown, field: string) =>
  assert.throws(fn, (e: unknown) => e instanceof LedgerBuildError && e.field === field, `expected LedgerBuildError for ${field}`);

describe("event builders: every event type is valid, frozen and self-hashed", () => {
  const built = [
    ["query_rejected", (c: EventContext) => buildQueryRejected(c, { engine: "google", queryPolicy: POLICY, field: "q", reasons: ["phone", "email"] })],
    ["provider_attempt", (c: EventContext) => buildProviderAttempt(c, { engine: "google", queryPolicy: POLICY, paramNames: ["q", "num", "location"], queryLength: 6, hasLocation: true, saveRequested: true, numRequested: 10 })],
    ["provider_succeeded", (c: EventContext) => buildProviderSucceeded(c, { engine: "google", resultCount: 10 })],
    ["provider_failed", (c: EventContext) => buildProviderFailed(c, { engine: "google", errorCode: "http_429" })],
    ["archive_succeeded", (c: EventContext) => buildArchiveSucceeded(c, { engine: "google", artifactUuid: ART, artifactHash: HASH, sanitizePolicy: SPOLICY })],
    ["archive_failed", (c: EventContext) => buildArchiveFailed(c, { engine: "google", errorCode: "archive_mirror", sanitizePolicy: SPOLICY })],
    ["sanitization_failed", (c: EventContext) => buildSanitizationFailed(c, { engine: "google", stage: "archive-body", sanitizePolicy: SPOLICY })],
    ["output_withheld", (c: EventContext) => buildOutputWithheld(c, { engine: "google", sanitizePolicy: SPOLICY })],
  ] as const;

  for (const [type, make] of built) {
    test(`B1 ${type}`, () => {
      const e = make(ctx());
      assert.equal(e.event_type, type);
      assert.equal(e.schema_version, "tpig-ledger-1");
      assert.equal(e.seq, 1);
      assert.match(e.occurred_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      const { row_hash, ...rest } = e;
      assert.equal(row_hash, rowHash(rest), "row_hash is the canonical hash of the event");
      assert.ok(Object.isFrozen(e), "event is frozen");
      for (const v of Object.values(e)) if (Array.isArray(v)) assert.ok(Object.isFrozen(v), "arrays are frozen too");
      assert.throws(() => { (e as { seq: number }).seq = 99; }, TypeError, "a frozen event cannot be changed");
    });
  }

  test("B1b seq increases by one per event and event_id is unique per event", () => {
    const c = ctx();
    const a = buildProviderAttempt(c, { engine: "google", queryPolicy: POLICY, paramNames: ["q"], queryLength: 1, hasLocation: false, saveRequested: false });
    const b = buildProviderSucceeded(c, { engine: "google", resultCount: 1 });
    assert.deepEqual([a.seq, b.seq], [1, 2]);
    assert.notEqual(a.event_id, b.event_id);
  });

  test("B2 arrays are sorted and de-duplicated (C collation)", () => {
    const e = buildProviderAttempt(ctx(), { engine: "google", queryPolicy: POLICY, paramNames: ["q", "num", "q", "location"], queryLength: 3, hasLocation: true, saveRequested: false });
    assert.deepEqual(e.param_names, ["location", "num", "q"]);
    const r = buildQueryRejected(ctx(), { queryPolicy: POLICY, field: "q", reasons: ["phone", "email", "phone"] });
    assert.deepEqual(r.reason_codes, ["email", "phone"]);
  });

  test("B3 optional fields are absent unless given; type-specific fields never leak across types", () => {
    const e = buildProviderSucceeded(ctx(), { engine: "google", resultCount: 0 });
    assert.deepEqual(Object.keys(e).sort(), ["app_version", "engine", "event_id", "event_type", "occurred_at", "phase", "provider", "result_count", "retrieval_id", "row_hash", "schema_version", "seq", "writer_id"].sort());
    assert.equal(buildQueryRejected(ctx(), { queryPolicy: POLICY, field: "engine", reasons: ["invalid_format"] }).engine, undefined);
    assert.equal(buildArchiveSucceeded(ctx(), { artifactUuid: ART, artifactHash: HASH, sanitizePolicy: SPOLICY }).provider, undefined);
  });
});

describe("event builders: invalid input is refused with a field name, never a value", () => {
  const base = { engine: "google", queryPolicy: POLICY, paramNames: ["q"], queryLength: 5, hasLocation: false, saveRequested: false } as const;

  test("B4 attempt field violations", () => {
    fail(() => buildProviderAttempt(ctx(), { ...base, queryLength: 0 }), "query_length");
    fail(() => buildProviderAttempt(ctx(), { ...base, queryLength: 257 }), "query_length");
    fail(() => buildProviderAttempt(ctx(), { ...base, queryLength: 1.5 }), "query_length");
    fail(() => buildProviderAttempt(ctx(), { ...base, paramNames: [] }), "param_names");
    fail(() => buildProviderAttempt(ctx(), { ...base, paramNames: ["q", "api_key"] }), "param_names");
    fail(() => buildProviderAttempt(ctx(), { ...base, paramNames: ["https://x.example/?token=abc"] }), "param_names");
    fail(() => buildProviderAttempt(ctx(), { ...base, numRequested: 0 }), "num_requested");
    fail(() => buildProviderAttempt(ctx(), { ...base, numRequested: 21 }), "num_requested");
    fail(() => buildProviderAttempt(ctx(), { ...base, dataType: "EVERYTHING" as never }), "data_type");
    fail(() => buildProviderAttempt(ctx(), { ...base, engine: "bing" as never }), "engine");
    fail(() => buildProviderAttempt(ctx(), { ...base, queryPolicy: "policy-1" }), "query_policy");
  });

  test("B5 outcome and archive field violations", () => {
    fail(() => buildProviderSucceeded(ctx(), { engine: "google", resultCount: -1 }), "result_count");
    fail(() => buildProviderSucceeded(ctx(), { engine: "google", resultCount: 100001 }), "result_count");
    fail(() => buildProviderFailed(ctx(), { engine: "google", errorCode: "HTTP 500 for https://serpapi.com/x?api_key=abc" }), "error_code");
    fail(() => buildProviderFailed(ctx(), { engine: "google", errorCode: "http_99" }), "error_code");
    fail(() => buildProviderFailed(ctx(), { engine: "google", errorCode: "http_600" }), "error_code");
    fail(() => buildArchiveSucceeded(ctx(), { artifactUuid: "not-a-uuid", artifactHash: HASH, sanitizePolicy: SPOLICY }), "artifact_uuid");
    fail(() => buildArchiveSucceeded(ctx(), { artifactUuid: ART.toUpperCase(), artifactHash: HASH, sanitizePolicy: SPOLICY }), "artifact_uuid");
    fail(() => buildArchiveSucceeded(ctx(), { artifactUuid: ART, artifactHash: "abc", sanitizePolicy: SPOLICY }), "artifact_hash");
    fail(() => buildArchiveSucceeded(ctx(), { artifactUuid: ART, artifactHash: HASH, sanitizePolicy: "x" }), "sanitize_policy");
    fail(() => buildArchiveFailed(ctx(), { errorCode: "oops" as never, sanitizePolicy: SPOLICY }), "error_code");
    fail(() => buildSanitizationFailed(ctx(), { stage: "everywhere" as never, sanitizePolicy: SPOLICY }), "stage");
    fail(() => buildQueryRejected(ctx(), { queryPolicy: POLICY, field: "password" as never, reasons: ["email"] }), "rejected_field");
    fail(() => buildQueryRejected(ctx(), { queryPolicy: POLICY, field: "q", reasons: [] }), "reason_codes");
    fail(() => buildQueryRejected(ctx(), { queryPolicy: POLICY, field: "q", reasons: ["jane@example.com" as never] }), "reason_codes");
  });

  test("B6 writer_id, app_version and id patterns", () => {
    const mk = (over: Partial<EventContext>) => () => buildProviderSucceeded(ctx(over), { engine: "google", resultCount: 1 });
    fail(mk({ writerId: "Has Space" }), "writer_id");
    fail(mk({ writerId: "a/b" }), "writer_id");
    fail(mk({ writerId: "a".repeat(32) }), "writer_id");        // a 32+ hex run could hide a key
    fail(mk({ writerId: "x".repeat(41) }), "writer_id");
    fail(mk({ appVersion: "1.0 beta" }), "app_version");
    fail(mk({ appVersion: "a".repeat(32) }), "app_version");
    fail(mk({ retrievalId: "NOT-A-UUID" }), "retrieval_id");
    fail(mk({ uuid: () => "ZZZZZZZZ-bbbb-4bbb-8bbb-000000000001" }), "event_id");
  });

  test("B7 occurred_at: shape, lower bound and a day ahead", () => {
    const at = (iso: string) => () => buildProviderSucceeded(ctx({ now: () => ({ toISOString: () => iso, getTime: () => Date.parse(iso) }) as unknown as Date }), { engine: "google", resultCount: 1 });
    fail(at("2025-12-31T23:59:59.999Z"), "occurred_at");
    fail(at("2026-11-01T12:00:00Z"), "occurred_at");               // no milliseconds
    fail(at("2026-11-01T12:00:00.123456Z"), "occurred_at");        // microseconds
    // The upper bound (a day ahead of the DATABASE clock) is enforced by the database; the writer only ever stamps its own clock.
    assert.doesNotThrow(at("2026-11-01T12:00:00.000Z"));
  });

  test("B8 seq limit", () => {
    let n = 1000;
    fail(() => buildProviderSucceeded(ctx({ nextSeq: () => ++n }), { engine: "google", resultCount: 1 }), "seq");
    assert.throws(() => buildProviderSucceeded(ctx({ nextSeq: () => 0 }), { engine: "google", resultCount: 1 }), LedgerBuildError);
  });

  test("B9 the error message names a field only", () => {
    try { buildProviderFailed(ctx(), { engine: "google", errorCode: "SECRETMARKER text" }); assert.fail("should throw"); }
    catch (e) { assert.ok(e instanceof LedgerBuildError); assert.ok(!e.message.includes("SECRETMARKER")); assert.match(e.message, /field "error_code"/); }
  });
});

describe("event builders: nothing but the named facts is ever copied", () => {
  test("B10 extra properties on the facts (query text, location, URLs, keys) never appear in the event", () => {
    const poisoned = {
      engine: "google", queryPolicy: POLICY, paramNames: ["q"], queryLength: 5, hasLocation: false, saveRequested: false,
      q: "SECRETQUERYTEXT", query: "SECRETQUERYTEXT", location: "SECRETPLACE", url: "https://serpapi.com/searches/TOKEN/x.json",
      api_key: "SECRETKEY", message: "SECRETMESSAGE",
    };
    const e = buildProviderAttempt(ctx(), poisoned as never);
    const text = JSON.stringify(e);
    for (const m of ["SECRETQUERYTEXT", "SECRETPLACE", "serpapi.com", "TOKEN", "SECRETKEY", "SECRETMESSAGE"]) {
      assert.ok(!text.includes(m), `leaked ${m}`);
    }
  });

  test("B11 property test: random inputs either throw LedgerBuildError or yield an allowlisted, self-consistent event", () => {
    let s = 12345;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
    const junk = ["", "x", "SECRET", "https://u:p@h/", "a".repeat(300), "http_200", "timeout", "%00", "💥"];
    const allowed = new Set([
      "event_id", "retrieval_id", "seq", "phase", "event_type", "schema_version", "provider", "engine", "query_policy", "sanitize_policy",
      "param_names", "query_length", "has_location", "data_type", "num_requested", "save_requested", "rejected_field", "reason_codes",
      "error_code", "stage", "result_count", "served_from_cache", "artifact_uuid", "artifact_hash", "writer_id", "app_version", "occurred_at", "row_hash",
    ]);
    let ok = 0, refused = 0;
    for (let i = 0; i < 400; i++) {
      const engine = rnd() < 0.8 ? pick(ENGINES) : (pick(junk) as never);
      const kind = Math.floor(rnd() * 8);
      try {
        const c = ctx();
        const e =
          kind === 0 ? buildQueryRejected(c, { engine, queryPolicy: rnd() < 0.8 ? POLICY : pick(junk), field: pick(["q", "location", "geo", "date", "engine", "data_type", pick(junk)]) as never, reasons: [pick(REASON_CODES), pick(junk) as never] }) :
          kind === 1 ? buildProviderAttempt(c, { engine, queryPolicy: POLICY, paramNames: [pick(["q", "num", pick(junk)])], queryLength: Math.floor(rnd() * 400) - 5, hasLocation: rnd() < 0.5, saveRequested: rnd() < 0.5 }) :
          kind === 2 ? buildProviderSucceeded(c, { engine, resultCount: Math.floor(rnd() * 200000) - 10 }) :
          kind === 3 ? buildProviderFailed(c, { engine, errorCode: rnd() < 0.5 ? `http_${Math.floor(rnd() * 800)}` : pick(junk) }) :
          kind === 4 ? buildArchiveSucceeded(c, { engine: rnd() < 0.5 ? engine : undefined, artifactUuid: rnd() < 0.5 ? ART : pick(junk), artifactHash: rnd() < 0.5 ? HASH : pick(junk), sanitizePolicy: SPOLICY }) :
          kind === 5 ? buildArchiveFailed(c, { errorCode: pick(["archive_write", "archive_mirror", "archive_unknown", pick(junk)]) as never, sanitizePolicy: SPOLICY }) :
          kind === 6 ? buildSanitizationFailed(c, { stage: rnd() < 0.7 ? pick(STAGES) : (pick(junk) as never), sanitizePolicy: SPOLICY }) :
                       buildOutputWithheld(c, { engine: rnd() < 0.5 ? engine : undefined, sanitizePolicy: SPOLICY });
        ok++;
        for (const k of Object.keys(e)) assert.ok(allowed.has(k), `unexpected key ${k}`);
        const { row_hash, ...rest } = e;
        assert.equal(row_hash, rowHash(rest));
        for (const m of ["SECRET", "https://", "💥", "%00"]) assert.ok(!JSON.stringify(e).includes(m), `junk ${m} reached an event`);
      } catch (err) {
        assert.ok(err instanceof LedgerBuildError, `unexpected error type: ${(err as Error).message}`);
        refused++;
      }
    }
    assert.ok(ok > 50 && refused > 50, `property test should exercise both outcomes (ok=${ok}, refused=${refused})`);
  });
});
