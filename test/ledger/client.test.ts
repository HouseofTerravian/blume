import "./setup.js";
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup } from "./setup.js";
import { APPEND_FUNCTION, SupabaseLedgerClient, classifyFailure } from "../../src/signals/ledger/client.js";
import { buildProviderFailed } from "../../src/signals/ledger/events.js";
import type { AppendResult, LedgerEvent } from "../../src/signals/ledger/types.js";

after(cleanup);

const event: LedgerEvent = buildProviderFailed(
  { retrievalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", writerId: "blume-test", appVersion: "1.0.0", nextSeq: () => 1, now: () => new Date("2026-11-01T12:00:00.000Z"), uuid: () => "bbbbbbbb-bbbb-4bbb-8bbb-000000000001" },
  { engine: "google", errorCode: "http_500" },
);

type RpcReply = { data?: unknown; error?: { message?: string; details?: string; hint?: string; code?: string } | null; status?: number };

/** A fake supabase client whose rpc() returns a thenable that also supports .abortSignal(), like the real builder. */
function fakeRpc(reply: (signal: AbortSignal | undefined, args: unknown) => Promise<RpcReply> | RpcReply, seen: { name?: string; args?: unknown } = {}): SupabaseClient {
  return {
    rpc(name: string, args: unknown) {
      seen.name = name; seen.args = args;
      let signal: AbortSignal | undefined;
      const builder = {
        abortSignal(s: AbortSignal) { signal = s; return builder; },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
          return Promise.resolve().then(() => reply(signal, args)).then(r => ({ data: r.data ?? null, error: r.error ?? null, status: r.status ?? 200 })).then(res, rej);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}
const append = (sb: SupabaseClient | null, timeoutMs = 1000): Promise<AppendResult> => new SupabaseLedgerClient(() => sb).append(event, { timeoutMs });

describe("classifyFailure maps only status and SQLSTATE to closed classes", () => {
  const cases: [string | undefined, number | undefined, string][] = [
    ["23000", 409, "conflict"], ["23505", 409, "seq_conflict"], ["23514", 400, "validation"], ["42501", 403, "permission"],
    ["42883", 404, "function_missing"], ["PGRST202", 404, "function_missing"], ["PGRST301", 401, "auth"], ["PGRST302", 401, "auth"],
    ["", 401, "auth"], [undefined, 403, "auth"], ["", 429, "rate_limited"], ["", 500, "server"], ["", 503, "server"],
    ["", 0, "network"], [undefined, undefined, "network"], ["XX000", 400, "unknown"], ["", 418, "unknown"],
  ];
  for (const [code, status, want] of cases) {
    test(`K2 code=${JSON.stringify(code)} status=${status} -> ${want}`, () => assert.equal(classifyFailure(code, status), want));
  }
  test("K2b aborted always means timeout, whatever else is reported", () => {
    assert.equal(classifyFailure("23000", 409, true), "timeout");
    assert.equal(classifyFailure("", 0, true), "timeout");
  });
});

describe("SupabaseLedgerClient", () => {
  test("K1 inserted and duplicate are acknowledgements; the call is rpc(name, { p: event })", async () => {
    const seen: { name?: string; args?: unknown } = {};
    assert.deepEqual(await append(fakeRpc(() => ({ data: "inserted" }), seen)), { ok: true, status: "inserted" });
    assert.equal(seen.name, APPEND_FUNCTION);
    assert.equal(APPEND_FUNCTION, "thq_append_retrieval_event");
    assert.deepEqual(Object.keys(seen.args as object), ["p"], "the argument is named p");
    assert.equal((seen.args as { p: unknown }).p, event, "the frozen event itself is sent, unchanged");
    assert.deepEqual(await append(fakeRpc(() => ({ data: "duplicate" }))), { ok: true, status: "duplicate" });
  });

  test("K3 database errors are classified from code and status only", async () => {
    assert.deepEqual(await append(fakeRpc(() => ({ error: { code: "23000" }, status: 409 }))), { ok: false, cls: "conflict" });
    assert.deepEqual(await append(fakeRpc(() => ({ error: { code: "23505" }, status: 409 }))), { ok: false, cls: "seq_conflict" });
    assert.deepEqual(await append(fakeRpc(() => ({ error: { code: "23514" }, status: 400 }))), { ok: false, cls: "validation" });
    assert.deepEqual(await append(fakeRpc(() => ({ error: { code: "", message: "x" }, status: 503 }))), { ok: false, cls: "server" });
  });

  test("K4 a poisoned message, details and hint are never read or returned", async () => {
    const poison = "SECRETMARKER sb_secret_abcdef https://serpapi.com/searches/TOKEN/x.json jane@example.com";
    let touched = 0;
    const trap = { get message() { touched++; return poison; }, get details() { touched++; return poison; }, get hint() { touched++; return poison; }, code: "23000" };
    const result = await append(fakeRpc(() => ({ error: trap as never, status: 409 })));
    assert.deepEqual(result, { ok: false, cls: "conflict" });
    assert.equal(touched, 0, "message/details/hint must not even be accessed");
    assert.ok(!JSON.stringify(result).includes("SECRETMARKER"));
  });

  test("K5 a call that never answers is aborted by the timeout and reported as timeout", async () => {
    const hung = fakeRpc(signal => new Promise<RpcReply>(resolve => signal?.addEventListener("abort", () => resolve({ error: { code: "" }, status: 0 }))));
    const started = Date.now();
    assert.deepEqual(await append(hung, 60), { ok: false, cls: "timeout" });
    assert.ok(Date.now() - started < 1000, "returned promptly after the timeout");
  });

  test("K6 a network failure (status 0, not aborted) is network; a thrown error is network", async () => {
    assert.deepEqual(await append(fakeRpc(() => ({ error: { code: "" }, status: 0 }))), { ok: false, cls: "network" });
    assert.deepEqual(await append(fakeRpc(() => { throw new Error("socket hang up SECRETMARKER"); })), { ok: false, cls: "network" });
  });

  test("K7 an unexpected successful reply is a protocol failure", async () => {
    assert.deepEqual(await append(fakeRpc(() => ({ data: "weird" }))), { ok: false, cls: "protocol" });
    assert.deepEqual(await append(fakeRpc(() => ({ data: null }))), { ok: false, cls: "protocol" });
    assert.deepEqual(await append(fakeRpc(() => ({ data: { status: "inserted" } }))), { ok: false, cls: "protocol" });
  });

  test("K8 no client (credentials absent) is an auth failure, not a silent skip", async () => {
    assert.deepEqual(await append(null), { ok: false, cls: "auth" });
  });
});
