import "./setup.js";
import test, { describe, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import axios, { AxiosError } from "axios";
import { FAKE_KEY, TEST_VAULT, cleanup, rawLog, readLog, resetLog, storedRawSignals } from "./setup.js";
import { serpSearch, trendsSearch } from "../../src/signals/sources/serp.js";
import { __injectRedactionFaultForTests, PolicyViolation, ProviderError, redactArtifactForRead } from "../../src/signals/policy.js";
import { ingestArtifact, getArtifact } from "../../src/artifacts/store.js";
import { isSupabaseEnabled } from "../../src/integrations/supabase.js";
import { computeHash } from "../../src/artifacts/routerTag.js";
import { logSignalEvent } from "../../src/signals/envelope.js";

assert.equal(isSupabaseEnabled(), false, "tests must never touch a live database");

const realGet = axios.get;
let calls: { url: string; params: Record<string, unknown> }[] = [];

function mockProvider(handler: () => unknown): void {
  (axios as unknown as { get: unknown }).get = async (url: string, cfg: { params: Record<string, unknown> }) => {
    calls.push({ url, params: cfg.params });
    return handler();
  };
}

const CAP = "https://serpapi.com/searches/FAKETOKENFAKETOKEN";
const providerBody = () => ({
  search_metadata: {
    id: "abc123", created_at: "2026-10-31 04:19:15 UTC",
    json_endpoint: `${CAP}/xyz.json`, raw_html_file: `${CAP}/xyz.html`,
    prettify_html_file: `${CAP}/xyz.prettify`, raw_html_md: `${CAP}/xyz.md`,
  },
  organic_results: [{ title: "Matcha guide", link: "https://example.com/matcha", snippet: "All about matcha" }],
  related_searches: [{ query: "matcha latte", link: "https://serpapi.com/search.json?engine=google&q=matcha+latte" }],
  interest_over_time: { timeline_data: [{ date: "Oct 2026", values: [{ value: "88" }] }] },
});

beforeEach(() => {
  calls = [];
  resetLog();
  fs.rmSync(path.join(TEST_VAULT, "_artifacts"), { recursive: true, force: true });
  mockProvider(() => ({ data: providerBody() }));
});
after(() => {
  (axios as unknown as { get: unknown }).get = realGet;
  cleanup();
});

describe("every provider entry point screens before any network call", () => {
  const prohibited: [string, string][] = [
    ["email", "reach jane.doe@example.com"], ["phone", "call 512-555-0100"], ["ssn", "078-05-1120"],
    ["card", "4111 1111 1111 1111"], ["credential", "api_key=abc12345"], ["capability url", `${CAP}/a.json`],
  ];
  for (const [name, text] of prohibited) {
    test(`serp q rejects ${name}`, async () => {
      await assert.rejects(serpSearch({ q: text }), PolicyViolation);
      assert.equal(calls.length, 0);
    });
    test(`trends q rejects ${name}`, async () => {
      await assert.rejects(trendsSearch({ q: text }), PolicyViolation);
      assert.equal(calls.length, 0);
    });
  }
  test("serp location is screened", async () => {
    await assert.rejects(serpSearch({ q: "matcha", location: "123 main street" }), PolicyViolation);
    await assert.rejects(serpSearch({ q: "matcha", location: "jane.doe@example.com" }), PolicyViolation);
    assert.equal(calls.length, 0);
  });
  test("trends geo and date are validated", async () => {
    await assert.rejects(trendsSearch({ q: "matcha", geo: "jane@example.com" }), PolicyViolation);
    await assert.rejects(trendsSearch({ q: "matcha", date: "512-555-0100" }), PolicyViolation);
    assert.equal(calls.length, 0);
  });
  test("engine and data_type are enum-checked", async () => {
    await assert.rejects(serpSearch({ q: "matcha", engine: "bing" }), PolicyViolation);
    await assert.rejects(trendsSearch({ q: "matcha", dataType: "EVERYTHING" }), PolicyViolation);
    assert.equal(calls.length, 0);
  });
  test('missing q is rejected, never searched as "undefined"', async () => {
    await assert.rejects(serpSearch({ q: undefined }), PolicyViolation);
    await assert.rejects(trendsSearch({ q: undefined }), PolicyViolation);
    assert.equal(calls.length, 0);
  });
});

describe("rejection logging is minimal", () => {
  test("only reason codes and event metadata are logged: no text, no hash", async () => {
    await assert.rejects(serpSearch({ q: "reach jane.doe@example.com", location: "Austin" }), PolicyViolation);
    const text = rawLog();
    assert.ok(!text.includes("jane.doe") && !text.includes("example.com"));
    const events = readLog();
    assert.equal(events.length, 1);
    assert.deepEqual(Object.keys(events[0]).sort(), ["at", "engine", "event", "field", "policy", "provider", "reasons"]);
    assert.equal(events[0].event, "query_rejected");
    assert.deepEqual(events[0].reasons, ["email"]);
    assert.ok(!/[0-9a-f]{16}/i.test(JSON.stringify(events[0])), "no digest-like value");
  });
});

describe("legitimate searches still work and are sanitized on the way out", () => {
  test("serp: results returned, capability URLs absent, key never in output or log", async () => {
    const out = await serpSearch({ q: "matcha", location: "Austin, Texas, United States" });
    const text = JSON.stringify(out);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].params.q, "matcha");
    assert.ok(text.includes("Matcha guide"));
    assert.ok(!text.includes("serpapi.com/searches") && !text.includes("FAKETOKEN") && !text.includes(FAKE_KEY));
    assert.ok(!rawLog().includes(FAKE_KEY));
    assert.equal(out.withheld, undefined);
  });
  test("serp: secrets and capability URLs inside RETURNED result fields are redacted", async () => {
    mockProvider(() => ({
      data: {
        ...providerBody(),
        organic_results: [{ title: "t", link: `${CAP}/leak.json`, snippet: `password: hunter22 and ${FAKE_KEY}` }],
        related_searches: [{ query: "x", link: `${CAP}/r.json?api_key=abcdef123456` }],
      },
    }));
    const out = await serpSearch({ q: "matcha" });
    const text = JSON.stringify(out);
    for (const leaked of ["FAKETOKEN", "hunter22", FAKE_KEY, "abcdef123456", "serpapi.com/searches"]) {
      assert.ok(!text.includes(leaked), `leaked ${leaked.slice(0, 6)}…`);
    }
    assert.ok(text.includes("[REDACTED:"));
  });
  test("trends: secrets inside the returned result are redacted", async () => {
    mockProvider(() => ({ data: { ...providerBody(), interest_over_time: { note: `token=abc123xyz ${CAP}/t.json ${FAKE_KEY}` } } }));
    const out = await trendsSearch({ q: "matcha" });
    const text = JSON.stringify(out);
    for (const leaked of ["FAKETOKEN", "abc123xyz", FAKE_KEY]) assert.ok(!text.includes(leaked), `leaked ${leaked.slice(0, 6)}…`);
  });
  test("trends: result returned and sanitized", async () => {
    const out = await trendsSearch({ q: "matcha", dataType: "TIMESERIES", geo: "US-TX", date: "today 12-m" });
    assert.ok(JSON.stringify(out).includes("Oct 2026"));
    assert.ok(!JSON.stringify(out).includes("FAKETOKEN"));
    assert.equal(calls[0].params.geo, "US-TX");
  });
  test("save: stored title, params, body and log are clean; hash intact; write-once preserved", async () => {
    const out = await serpSearch({ q: "matcha", save: true });
    const saved = out.saved as { uuid: string; hash: string };
    assert.ok(saved?.uuid);
    const files = storedRawSignals();
    assert.equal(files.length, 1);
    const stored = JSON.parse(fs.readFileSync(path.join(TEST_VAULT, "_artifacts", "house", files[0]), "utf-8"));
    const all = JSON.stringify(stored);
    assert.ok(!all.includes("serpapi.com/searches") && !all.includes("FAKETOKEN") && !all.includes(FAKE_KEY));
    assert.ok(all.includes("[REDACTED:provider-capability-url]"));
    assert.equal(stored.metadata.sanitization_policy, "tpig-sanitize-2");
    assert.equal(stored.hash, computeHash(stored.body));
    assert.equal(JSON.parse(stored.body).sanitization.policy, "tpig-sanitize-2");
    assert.ok(getArtifact(saved.uuid));
    assert.ok(!rawLog().includes("FAKETOKEN") && !rawLog().includes(FAKE_KEY));
    // existing guards still hold
    await assert.rejects(ingestArtifact({ brand: "house", title: "x", body: "x" }), /reserved institutional scope/);
    await assert.rejects(
      ingestArtifact({ brand: "somebrand", title: "x", body: "x", metadata: { kind: "tpig.raw_signal" } }),
      /reserved for the signal envelope writer/,
    );
  });
});

describe("provider errors cannot expose credentials, capability URLs or identifiers", () => {
  function axiosFailure(status: number, providerMessage: string): AxiosError {
    const err = new AxiosError(
      `Request failed with status code ${status} for https://serpapi.com/search.json?api_key=${FAKE_KEY}&q=matcha`,
      "ERR_BAD_REQUEST",
      { url: `https://serpapi.com/search.json?api_key=${FAKE_KEY}` } as never,
      {},
      { status, data: { error: providerMessage }, statusText: "", headers: {}, config: {} as never },
    );
    return err;
  }
  const failWith = (err: unknown) => mockProvider(() => { throw err; });
  const failure = async (promise: Promise<unknown>): Promise<string> => {
    try { await promise; assert.fail("should throw"); } catch (e) { assert.ok(e instanceof ProviderError, String(e)); return (e as Error).message; }
    return "";
  };

  test("key echoed in the provider message is dropped", async () => {
    failWith(axiosFailure(401, `Invalid API key. Your API key should be ${FAKE_KEY}.`));
    const msg = await failure(serpSearch({ q: "matcha" }));
    assert.equal(msg, "SerpAPI request failed (HTTP 401)");
    assert.ok(!msg.includes(FAKE_KEY) && !msg.includes("api_key"));
  });
  test("capability URL in the provider message is dropped", async () => {
    failWith(axiosFailure(500, `see ${CAP}/x.json`));
    assert.equal(await failure(serpSearch({ q: "matcha" })), "SerpAPI request failed (HTTP 500)");
  });
  test("a provider echoing the query back is dropped", async () => {
    failWith(axiosFailure(400, "Google hasn't returned any results for matcha latte"));
    assert.equal(await failure(serpSearch({ q: "matcha latte" })), "SerpAPI request failed (HTTP 400)");
  });
  test("a clean provider message is kept", async () => {
    failWith(axiosFailure(429, "Your account has run out of searches."));
    assert.equal(await failure(serpSearch({ q: "matcha" })), "SerpAPI request failed (HTTP 429): Your account has run out of searches.");
  });
  test("a 200 response with an error field is handled the same way", async () => {
    mockProvider(() => ({ data: { error: `bad key ${FAKE_KEY}` } }));
    const msg = await failure(trendsSearch({ q: "matcha" }));
    assert.ok(!msg.includes(FAKE_KEY));
  });
  test("non-axios failures are generic and the log carries no secret", async () => {
    failWith(new Error(`socket hang up while calling https://serpapi.com/search.json?api_key=${FAKE_KEY}`));
    const msg = await failure(serpSearch({ q: "matcha" }));
    assert.equal(msg, "SerpAPI request failed");
    assert.ok(!rawLog().includes(FAKE_KEY) && !rawLog().includes("api_key"));
    assert.ok(readLog().some(e => e.event === "retrieval_failed"));
  });
});

describe("a failed sanitization never makes the unsanitized response safe to return", () => {
  test("output is withheld, nothing is stored, log carries no content", async () => {
    mockProvider(() => ({ data: { ...providerBody(), note: `leaked ${FAKE_KEY}` } }));
    __injectRedactionFaultForTests(true);
    let out: Record<string, unknown>;
    try {
      out = await serpSearch({ q: "matcha", save: true });
    } finally {
      __injectRedactionFaultForTests(false);
    }
    const text = JSON.stringify(out);
    assert.equal(out.withheld, true);
    assert.equal(out.results, undefined);
    assert.ok(!text.includes(FAKE_KEY) && !text.includes("FAKETOKEN") && !text.includes("Matcha guide"));
    assert.equal(storedRawSignals().length, 0);
    assert.ok(readLog().some(e => e.event === "sanitization_failed"));
    assert.ok(!rawLog().includes(FAKE_KEY) && !rawLog().includes("FAKETOKEN"));
  });
  test("withheld also applies when nothing was requested to be saved", async () => {
    mockProvider(() => ({ data: { ...providerBody(), note: `leaked ${FAKE_KEY}` } }));
    __injectRedactionFaultForTests(true);
    let out: Record<string, unknown>;
    try {
      out = await trendsSearch({ q: "matcha" });
    } finally {
      __injectRedactionFaultForTests(false);
    }
    assert.equal(out.withheld, true);
    assert.ok(!JSON.stringify(out).includes(FAKE_KEY));
  });
  test("log events that cannot be verified are replaced by a content-free marker", () => {
    __injectRedactionFaultForTests(true);
    try {
      logSignalEvent({ event: "x", note: `leak ${FAKE_KEY} ${CAP}/a.json` });
    } finally {
      __injectRedactionFaultForTests(false);
    }
    const text = rawLog();
    assert.ok(!text.includes(FAKE_KEY) && !text.includes("FAKETOKEN"));
    assert.equal(readLog()[0].event, "log_suppressed");
  });
  test("log events with secrets are redacted in normal operation", () => {
    logSignalEvent({ event: "x", note: `leak ${FAKE_KEY} ${CAP}/a.json`, api_key: "abcdef123456" });
    const text = rawLog();
    assert.ok(!text.includes(FAKE_KEY) && !text.includes("FAKETOKEN") && !text.includes("abcdef123456"));
  });
});

describe("MCP read responses are routed through read-time redaction", () => {
  test("artifact_get and artifact_list handlers call redactArtifactForRead", () => {
    const src = fs.readFileSync(path.resolve("src/mcp/server.ts"), "utf-8");
    assert.match(src, /case "artifact_get":[\s\S]*?redactArtifactForRead\(art\)/);
    assert.match(src, /case "artifact_list":[\s\S]*?arts\.map\(redactArtifactForRead\)/);
  });
  test("non-raw-signal artifacts are returned untouched", () => {
    const a = { uuid: "u", title: "t", body: "https://serpapi.com/searches/X/y.json", metadata: { kind: "other" } };
    assert.equal(redactArtifactForRead(a), a);
  });
});
