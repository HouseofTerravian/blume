import "./setup.js";
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup } from "./setup.js";
import { fetchReconciliation, summarizeReconciliation, type ReconciliationRow } from "../../src/signals/ledger/reconcile.js";

after(cleanup);

const row = (issue: string, rid: string | null = "11111111-1111-4111-8111-111111111111", art: string | null = null): ReconciliationRow =>
  ({ issue, retrieval_id: rid, artifact_uuid: art, event_count: 2, first_recorded_at: "2026-11-01T00:00:00Z" });

describe("reconciliation report", () => {
  test("R1 counts per issue; pre_ledger_artifact is informational, everything else is actionable", () => {
    const s = summarizeReconciliation([row("pre_ledger_artifact", null, "c0dc83b0-d609-4ff8-9988-f8c3b6ed861a"), row("incomplete_retrieval"), row("incomplete_retrieval"), row("sequence_gap")]);
    assert.equal(s.total, 4);
    assert.deepEqual(s.byIssue, { pre_ledger_artifact: 1, incomplete_retrieval: 2, sequence_gap: 1 });
    assert.equal(s.actionable, 3);
  });

  test("R2 nothing but the pre-ledger artifact means nothing to act on", () => {
    assert.equal(summarizeReconciliation([row("pre_ledger_artifact", null, "c0dc83b0-d609-4ff8-9988-f8c3b6ed861a")]).actionable, 0);
    assert.equal(summarizeReconciliation([]).actionable, 0);
  });

  test("R3 ids are shown as 8-character prefixes only", () => {
    const s = summarizeReconciliation([row("artifact_without_ledger", "abcdef01-2345-4678-89ab-cdef01234567", "fedcba98-7654-4321-8fed-cba987654321")]);
    const text = s.lines.join("\n");
    assert.ok(text.includes("abcdef01") && text.includes("fedcba98"));
    assert.ok(!text.includes("abcdef01-2345") && !text.includes("fedcba98-7654"));
  });
});

describe("fetchReconciliation reads only closed information", () => {
  const client = (reply: () => unknown): SupabaseClient => ({ from: () => ({ select: () => reply() }) }) as unknown as SupabaseClient;

  test("R4 no client is a closed reason", async () => assert.deepEqual(await fetchReconciliation(null), { ok: false, reason: "no_client" }));

  test("R5 rows are returned; an error never has its message read", async () => {
    const rows = [row("sequence_gap")];
    assert.deepEqual(await fetchReconciliation(client(() => Promise.resolve({ data: rows, error: null }))), { ok: true, rows });
    let touched = 0;
    const trap = { get message() { touched++; return "SECRETMARKER"; }, get details() { touched++; return "SECRETMARKER"; }, code: "42501" };
    const failed = await fetchReconciliation(client(() => Promise.resolve({ data: null, error: trap })));
    assert.deepEqual(failed, { ok: false, reason: "query_failed" });
    assert.equal(touched, 0);
    assert.deepEqual(await fetchReconciliation(client(() => { throw new Error("SECRETMARKER"); })), { ok: false, reason: "query_failed" });
    assert.deepEqual(await fetchReconciliation(client(() => Promise.resolve({ data: "not an array", error: null }))), { ok: false, reason: "query_failed" });
  });
});
