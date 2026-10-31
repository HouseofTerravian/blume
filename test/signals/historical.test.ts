import "./setup.js";
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { TEST_VAULT, cleanup } from "./setup.js";
import { redactArtifactForRead, __injectRedactionFaultForTests } from "../../src/signals/policy.js";
import { getArtifact } from "../../src/artifacts/store.js";
import { computeHash } from "../../src/artifacts/routerTag.js";

after(cleanup);

const sha256File = (p: string) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");

/** Writes an artifact exactly as the store would have: JSON file, body hash recorded. */
function writeHistorical(body: string, policy: string | null, schema: string): { uuid: string; file: string } {
  const uuid = randomUUID();
  const dir = path.join(TEST_VAULT, "_artifacts", "house");
  fs.mkdirSync(dir, { recursive: true });
  const artifact = {
    uuid, brand: "house", vault: "rnd", switch: null,
    title: "serpapi/google_trends: matcha", timestamp: "2026-10-31T05:12:44.513Z", version: 1, source: "imported",
    hash: computeHash(body),
    metadata: { kind: "tpig.raw_signal", scope: "institutional", schema_version: schema, ...(policy ? { sanitization_policy: policy } : {}) },
    body, ref: null, parent_uuid: null, updated_at: "2026-10-31T05:12:44.513Z",
  };
  const file = path.join(dir, `${uuid}.json`);
  fs.writeFileSync(file, JSON.stringify(artifact, null, 2), "utf-8");
  return { uuid, file };
}

const CAP = "https://serpapi.com/searches/FAKETOKENFAKETOKEN";
const legacyBody = JSON.stringify(
  {
    schema_version: "tpig-raw-0", provider: "serpapi", engine: "google_trends",
    params: { q: "matcha" },
    response: {
      search_metadata: { id: "abc", json_endpoint: `${CAP}/a.json`, raw_html_file: `${CAP}/a.html`, prettify_html_file: `${CAP}/a.prettify`, raw_html_md: `${CAP}/a.md` },
      interest_over_time: { timeline_data: [{ date: "Oct 2026" }] },
    },
  },
  null,
  2,
);

describe("historical local artifacts (tpig-raw-0, pre-policy) are redacted on read, never mutated", () => {
  const { uuid, file } = writeHistorical(legacyBody, null, "tpig-raw-0");

  test("read-time redaction removes every capability URL from the returned copy", () => {
    const stored = getArtifact(uuid)!;
    const out = redactArtifactForRead(stored);
    const text = JSON.stringify(out);
    assert.ok(!text.includes("serpapi.com/searches") && !text.includes("FAKETOKEN"));
    assert.equal(out.read_redacted, true);
    assert.ok((out.read_redaction_count ?? 0) >= 4);
    assert.ok(JSON.parse(out.body as string), "redacted body is still valid JSON");
    assert.ok((out.body as string).includes("Oct 2026"), "legitimate content preserved");
  });
  test("the stored record is untouched and its hash still verifies", () => {
    const before = sha256File(file);
    const stored = getArtifact(uuid)!;
    const out = redactArtifactForRead(stored);
    assert.equal(sha256File(file), before, "file bytes unchanged by a read");
    assert.equal(computeHash(stored.body!), stored.hash, "stored body still matches its recorded hash");
    assert.equal(out.hash, stored.hash, "copy reports the stored hash, which describes the stored body");
    assert.ok(stored.body!.includes("serpapi.com/searches"), "immutable original is not rewritten");
    assert.ok(getArtifact(uuid), "integrity check on the stored record still passes");
  });
  test("a redaction that cannot be verified withholds the body instead of returning it", () => {
    __injectRedactionFaultForTests(true);
    try {
      const out = redactArtifactForRead(getArtifact(uuid)!);
      assert.equal(out.body, "[WITHHELD:redaction-unverified]");
      assert.ok(!JSON.stringify(out).includes("FAKETOKEN"));
    } finally {
      __injectRedactionFaultForTests(false);
    }
  });
});

describe("tpig-sanitize-1 records read back unchanged", () => {
  const body = JSON.stringify(
    { schema_version: "tpig-raw-1", params: { q: "matcha" }, response: { search_metadata: { json_endpoint: "[REDACTED:provider-capability-url]" } } },
    null,
    2,
  );
  const { uuid } = writeHistorical(body, "tpig-sanitize-1", "tpig-raw-1");
  test("already-sanitized body is returned as stored and not flagged", () => {
    const stored = getArtifact(uuid)!;
    const out = redactArtifactForRead(stored);
    assert.equal(out.read_redacted, false);
    assert.equal(out.body, stored.body);
  });
});

describe("real local raw signals on this machine (skipped when absent)", () => {
  const dir = path.resolve("vaults/_artifacts/house");
  const find = (prefix: string) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).find(f => f.startsWith(prefix) && f.endsWith(".json")) : undefined;

  test("b605c34b: read output has no capability URLs; file and hash are untouched", t => {
    const name = find("b605c34b");
    if (!name) return t.skip("local copy of b605c34b not present");
    const file = path.join(dir, name);
    const before = sha256File(file);
    const stored = JSON.parse(fs.readFileSync(file, "utf-8"));
    assert.equal(computeHash(stored.body), stored.hash, "original hash valid");
    const out = redactArtifactForRead(stored);
    const text = JSON.stringify(out);
    assert.ok(!text.includes("serpapi.com/searches"), "no capability URL in the returned copy");
    assert.equal(out.hash, stored.hash);
    assert.equal(sha256File(file), before, "file bytes unchanged");
  });
  test("c0dc83b0: sanitized-1 record is returned as stored", t => {
    const name = find("c0dc83b0");
    if (!name) return t.skip("local copy of c0dc83b0 not present");
    const stored = JSON.parse(fs.readFileSync(path.join(dir, name), "utf-8"));
    const out = redactArtifactForRead(stored);
    assert.equal(out.read_redacted, false);
    assert.equal(out.body, stored.body);
    assert.equal(computeHash(stored.body), stored.hash);
  });
});
