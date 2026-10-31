import "./setup.js";
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import { FAKE_KEY, cleanup } from "./setup.js";
import {
  PolicyViolation, SanitizationFailure, __injectRedactionFaultForTests, detectIdentifiers, isClean,
  redactText, redactValue, sanitizeStructure, screenGeo, screenText, screenTrendsDate,
} from "../../src/signals/policy.js";

after(cleanup);

const q = (v: unknown) => screenText("q", v, { max: 256, mode: "query", required: true });
const reasonsOf = (v: unknown, field = "q", mode: "query" | "locality" = "query"): string[] => {
  try { screenText(field, v, { max: 256, mode, required: true }); return []; }
  catch (e) { assert.ok(e instanceof PolicyViolation); return e.reasons; }
};

describe("input screening: prohibited identifiers are rejected", () => {
  const cases: [string, string, string][] = [
    ["email", "contact me at jane.doe@example.com", "email"],
    ["US phone dashed", "call 512-555-0100", "phone"],
    ["US phone parenthesised", "(512) 555-0100 austin", "phone"],
    ["E.164 phone", "+15125550100", "phone"],
    ["bare 10 digits", "5125550100", "phone"],
    ["SSN", "078-05-1120", "national_id"],
    ["card (Luhn valid)", "4111 1111 1111 1111", "payment_card"],
    ["card dashed", "4111-1111-1111-1111", "payment_card"],
    ["IBAN (mod-97 valid)", "GB82 WEST 1234 5698 7654 32", "iban"],
    ["street address at end", "123 main street", "street_address"],
    ["street address with locality", "123 Main Street, Austin", "street_address"],
    ["street address with ZIP", "45 oak avenue 78701", "street_address"],
    ["PO box", "p.o. box 1234", "street_address"],
  ];
  for (const [name, text, reason] of cases) {
    test(name, () => assert.ok(reasonsOf(text).includes(reason), `expected ${reason}`));
  }
});

describe("input screening: credentials and tokenized URLs are rejected", () => {
  const cases: [string, string, string][] = [
    ["Supabase secret key", "sb_secret_abcdefghijklmnop", "credential"],
    ["JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop", "credential"],
    ["api_key pair", "api_key=abc12345", "credential"],
    ["password pair", "password: hunter22", "credential"],
    ["bearer token", "Bearer abcdefghijklmnopqrstuvwxyz", "credential"],
    ["sk- key", "sk-abcdefghijklmnopqrstuvwx", "credential"],
    ["64-hex secret", "a".repeat(64), "credential"],
    ["the live provider key itself", `search ${FAKE_KEY}`, "credential"],
    ["URL token param", "https://example.com/x?token=abc123xyz", "tokenized_url"],
    ["URL userinfo", "https://user:pass@example.com/", "tokenized_url"],
    ["provider capability URL", "https://serpapi.com/searches/FAKETOKEN/abc.json", "tokenized_url"],
  ];
  for (const [name, text, reason] of cases) {
    test(name, () => assert.ok(reasonsOf(text).includes(reason), `expected ${reason}`));
  }
});

describe("input hygiene", () => {
  test("missing, non-string, empty, long and control-character values", () => {
    assert.deepEqual(reasonsOf(undefined), ["invalid_type"]);
    assert.deepEqual(reasonsOf(42), ["invalid_type"]);
    assert.deepEqual(reasonsOf("   "), ["empty"]);
    assert.deepEqual(reasonsOf("x".repeat(257)), ["too_long"]);
    assert.deepEqual(reasonsOf("a\u0000b"), ["control_characters"]);
  });
  test("a violation message carries field and codes, never the text", () => {
    try { q("reach jane.doe@example.com or 078-05-1120"); assert.fail("should reject"); }
    catch (e) {
      assert.ok(e instanceof PolicyViolation);
      assert.ok(!e.message.includes("jane.doe") && !e.message.includes("078-05"));
      assert.match(e.message, /field "q"/);
    }
  });
  test("location is screened in locality mode (no lookahead)", () => {
    assert.ok(reasonsOf("10 downing street", "location", "locality").includes("street_address"));
    assert.deepEqual(reasonsOf("Austin, Texas, United States", "location", "locality"), []);
  });
  test("geo and date accept TPIG forms and reject everything else", () => {
    assert.equal(screenGeo("US"), "US");
    assert.equal(screenGeo("US-TX"), "US-TX");
    assert.equal(screenGeo(undefined), undefined);
    for (const bad of ["united states", "US; drop", "123", 5]) assert.throws(() => screenGeo(bad), PolicyViolation);
    for (const ok of ["today 12-m", "now 7-d", "all", "2026-01-01 2026-06-30"]) assert.equal(screenTrendsDate(ok), ok);
    for (const bad of ["yesterday", "jane@example.com", "today 12-m; x"]) assert.throws(() => screenTrendsDate(bad), PolicyViolation);
  });
});

describe("legitimate public-topic queries are preserved", () => {
  const legit = [
    "matcha", "gen z trends 2026", "route 66 road trip", "iphone 16 pro max review",
    "best street food in austin", "10 best road trips in texas", "5 star hotels in new york",
    "top 10 things to do in tokyo", "nba finals 2026 schedule", "taylor swift concert dates",
    "how to start a podcast", "covid-19 vaccine rates", "python 3.12 release notes",
    "coffee, tea, matcha", "sxsw 2026 events austin tx", "apple vs android market share 2025",
    "who won the 2024 election", "minimum wage by state 2026", "tesla model 3 price",
    "1984 george orwell summary", "world cup 2026 tickets", "401k contribution limits 2026",
    "area 51 documentary", "7 wonders of the world", "windows 11 24h2", "pantone color of the year 2026",
    "mortgage rates 30 year fixed", "5 best drive in theaters near me", "100 club street food",
    "https://example.com/blog/matcha-guide", "site:example.com matcha", "token ring network history",
  ];
  for (const text of legit) test(`passes: ${text}`, () => assert.equal(q(text), text));
});

describe("documented detection limits (false positives and negatives)", () => {
  test("known false positives are rejected: address-shaped public landmarks", () => {
    assert.ok(reasonsOf("1600 pennsylvania avenue").includes("street_address"));
    assert.ok(reasonsOf("highway 101 california coast drive").includes("street_address"));
  });
  test("known false negatives pass: non-Luhn 16 digits, spaced international phone, names", () => {
    assert.equal(q("1234567890123456"), "1234567890123456");
    assert.equal(q("+44 20 7946 0958"), "+44 20 7946 0958");
    assert.equal(q("john a smith 12 maple court"), "john a smith 12 maple court");
  });
});

describe("redaction (tpig-sanitize-2)", () => {
  test("capability URLs are redacted at any position, nested", () => {
    const input = {
      json_endpoint: "https://serpapi.com/searches/FAKETOKEN/abc.json",
      note: "see https://serpapi.com/searches/FAKETOKEN/abc.html for more",
      nested: [{ files: ["https://serpapi.com/searches/FAKETOKEN/abc.md"] }],
    };
    const { value, redactedPaths } = redactValue(input);
    const text = JSON.stringify(value);
    assert.ok(!text.includes("serpapi.com/searches") && !text.includes("FAKETOKEN"));
    assert.ok(text.includes("[REDACTED:provider-capability-url]"));
    assert.equal(redactedPaths.length, 3);
  });
  test("credentials: known key, JWT, pairs, URL params, sensitive keys", () => {
    const input = {
      a: `prefix ${FAKE_KEY} suffix`,
      b: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
      c: "login with password: hunter22 now",
      d: "https://example.com/x?token=abc123xyz&ok=1",
      api_key: "abcdef123456",
      authorization: "Bearer abcdefghijklmnopqrstuvwxyz",
    };
    const text = JSON.stringify(redactValue(input).value);
    for (const leaked of [FAKE_KEY, "eyJhbGci", "hunter22", "abc123xyz", "abcdef123456", "abcdefghijklmnopqrstuvwxyz"]) {
      assert.ok(!text.includes(leaked), `leaked ${leaked.slice(0, 6)}…`);
    }
    assert.ok(text.includes("ok=1"));
  });
  test("is idempotent and leaves ordinary text and hashes alone", () => {
    const sha = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const plain = `matcha demand is rising; sha ${sha}; see https://example.com/a?b=1`;
    assert.equal(redactText(plain).text, plain);
    const dirty = `x https://serpapi.com/searches/FAKETOKEN/a.json y password=hunter22`;
    const once = redactText(dirty).text;
    assert.equal(redactText(once).count, 0);
    assert.ok(isClean(once));
  });
});

describe("sanitization failure is fail-closed", () => {
  test("a redactor that misses content is caught by the residual check", () => {
    __injectRedactionFaultForTests(true);
    try {
      assert.throws(
        () => sanitizeStructure({ x: "https://serpapi.com/searches/FAKETOKEN/a.json" }, "response"),
        SanitizationFailure,
      );
      assert.throws(() => sanitizeStructure({ x: `leak ${FAKE_KEY}` }, "response"), SanitizationFailure);
    } finally {
      __injectRedactionFaultForTests(false);
    }
  });
  test("the failure message carries the stage only, never content", () => {
    __injectRedactionFaultForTests(true);
    try {
      sanitizeStructure({ x: `leak ${FAKE_KEY}` }, "response");
      assert.fail("should throw");
    } catch (e) {
      assert.ok(e instanceof SanitizationFailure);
      assert.ok(!e.message.includes("TESTSERPKEY"));
    } finally {
      __injectRedactionFaultForTests(false);
    }
  });
  test("fault injection is refused outside NODE_ENV=test", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try { assert.throws(() => __injectRedactionFaultForTests(true)); } finally { process.env.NODE_ENV = prev; }
  });
  test("detectIdentifiers is stable on empty input", () => assert.deepEqual(detectIdentifiers("", "query"), []));
});
