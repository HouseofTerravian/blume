import "./setup.js";
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { cleanup } from "./setup.js";
import { CANONICAL_FIELDS, canonicalString, rowHash } from "../../src/signals/ledger/canonical.js";
import type { LedgerEvent } from "../../src/signals/ledger/types.js";

after(cleanup);

// The same fixture the database test suite uses (scripts/local-test/run.sh in revenue-core-infra). The expected hash below
// was computed independently of both the database and this writer.
const FIXTURE: Omit<LedgerEvent, "row_hash"> = {
  event_id: "11111111-1111-4111-8111-111111111111",
  retrieval_id: "22222222-2222-4222-8222-222222222222",
  seq: 1,
  phase: "provider",
  event_type: "provider_attempt",
  schema_version: "tpig-ledger-1",
  provider: "serpapi",
  engine: "google_trends",
  query_policy: "tpig-query-policy-1",
  param_names: ["data_type", "q"],
  query_length: 7,
  has_location: false,
  data_type: "TIMESERIES",
  save_requested: true,
  writer_id: "blume-test",
  app_version: "1.0.0",
  occurred_at: "2026-10-31T12:00:00.000Z",
};
const KNOWN_ANSWER = "b582a3d4c8d473783862df49e25b3696087e1e1e7fa1e7f68b5b42366aeb0f0a";

describe("canonical row hash", () => {
  test("C1 known-answer vector matches the independent computation", () => {
    assert.equal(rowHash(FIXTURE), KNOWN_ANSWER);
  });

  test("C1b the canonical string is exactly the 30 fields joined by the unit separator", () => {
    const expected = [
      "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "1", "provider", "provider_attempt",
      "tpig-ledger-1", "serpapi", "google_trends", "tpig-query-policy-1", "", "data_type,q", "7", "false", "TIMESERIES", "", "true",
      "", "", "", "", "", "", "", "", "", "", "", "blume-test", "1.0.0", "2026-10-31T12:00:00.000Z",
    ].join("\x1f");
    assert.equal(CANONICAL_FIELDS.length, 30);
    assert.equal(canonicalString(FIXTURE), expected);
    assert.equal(createHash("sha256").update(expected, "utf8").digest("hex"), KNOWN_ANSWER);
  });

  test("C2 absent, undefined and null render as the empty string; false and 0 do not", () => {
    const a = canonicalString({ ...FIXTURE, has_location: false, query_length: 0 });
    assert.ok(a.split("\x1f")[12] === "false" && a.split("\x1f")[11] === "0");
    const withNull = { ...FIXTURE, data_type: null } as unknown as Omit<LedgerEvent, "row_hash">;
    const withoutKey: Omit<LedgerEvent, "row_hash"> = { ...FIXTURE };
    delete (withoutKey as Partial<LedgerEvent>).data_type;
    assert.equal(canonicalString(withNull), canonicalString(withoutKey));
  });

  test("C3 arrays are comma-joined in the order given (builders sort them first)", () => {
    assert.equal(canonicalString({ ...FIXTURE, param_names: ["a", "b", "c"] as never }).split("\x1f")[10], "a,b,c");
  });

  test("C4 server-owned and retention fields never contribute", () => {
    const extra = { ...FIXTURE, recorded_at: "2000-01-01T00:00:00Z", txid: 1, row_hash: "x" } as unknown as Omit<LedgerEvent, "row_hash">;
    assert.equal(rowHash(extra), KNOWN_ANSWER);
    assert.deepEqual(canonicalString(FIXTURE).split("\x1f").slice(24, 27), ["", "", ""]);
  });

  test("C5 changing any single hashed field changes the hash", () => {
    const changes: Record<string, unknown> = {
      event_id: "11111111-1111-4111-8111-111111111112", retrieval_id: "22222222-2222-4222-8222-222222222223", seq: 2,
      phase: "archive", event_type: "provider_failed", schema_version: "tpig-ledger-2", provider: "other", engine: "google",
      query_policy: "tpig-query-policy-2", sanitize_policy: "tpig-sanitize-2", param_names: ["q"], query_length: 8, has_location: true,
      data_type: "GEO_MAP", num_requested: 5, save_requested: false, rejected_field: "q", reason_codes: ["email"],
      error_code: "timeout", stage: "output", result_count: 3, served_from_cache: true,
      artifact_uuid: "33333333-3333-4333-8333-333333333333", artifact_hash: "a".repeat(64),
      writer_id: "blume-other", app_version: "2.0.0", occurred_at: "2026-10-31T12:00:00.001Z",
    };
    for (const [field, value] of Object.entries(changes)) {
      const mutated = { ...FIXTURE, [field]: value } as Omit<LedgerEvent, "row_hash">;
      assert.notEqual(rowHash(mutated), KNOWN_ANSWER, `changing ${field} did not change the hash`);
    }
  });

  test("C6 the hash is a 64-character lower-case hex digest", () => {
    assert.match(rowHash(FIXTURE), /^[0-9a-f]{64}$/);
  });
});
