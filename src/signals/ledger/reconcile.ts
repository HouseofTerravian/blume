// Read-only reconciliation helpers: summarise rows of public.thq_retrieval_reconciliation (the deployed view).
// Output carries issue names, counts and 8-character id PREFIXES only. The database error text is never read.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReconciliationRow {
  issue: string;
  retrieval_id: string | null;
  artifact_uuid: string | null;
  event_count: number | null;
  first_recorded_at: string | null;
}

/** pre_ledger_artifact is informational (an artifact older than the ledger); every other issue needs a human. */
export const INFORMATIONAL_ISSUES: ReadonlySet<string> = new Set(["pre_ledger_artifact"]);

export interface ReconciliationSummary {
  total: number;
  byIssue: Record<string, number>;
  actionable: number;
  lines: string[];
}

const prefix = (id: string | null): string => (id ? id.slice(0, 8) : "-");

export function summarizeReconciliation(rows: readonly ReconciliationRow[]): ReconciliationSummary {
  const byIssue: Record<string, number> = {};
  for (const r of rows) byIssue[r.issue] = (byIssue[r.issue] ?? 0) + 1;
  const actionable = rows.filter(r => !INFORMATIONAL_ISSUES.has(r.issue)).length;
  const lines = [...rows]
    .sort((a, b) => a.issue.localeCompare(b.issue) || prefix(a.retrieval_id).localeCompare(prefix(b.retrieval_id)))
    .map(r => `${r.issue.padEnd(28)} retrieval=${prefix(r.retrieval_id)} artifact=${prefix(r.artifact_uuid)} events=${r.event_count ?? "-"}`);
  return { total: rows.length, byIssue, actionable, lines };
}

export type FetchResult = { ok: true; rows: ReconciliationRow[] } | { ok: false; reason: "no_client" | "query_failed" };

/** SELECT only. On failure, returns a closed reason: error.message / details / hint are never read. */
export async function fetchReconciliation(sb: SupabaseClient | null): Promise<FetchResult> {
  if (!sb) return { ok: false, reason: "no_client" };
  try {
    const { data, error } = await sb
      .from("thq_retrieval_reconciliation")
      .select("issue, retrieval_id, artifact_uuid, event_count, first_recorded_at");
    if (error || !Array.isArray(data)) return { ok: false, reason: "query_failed" };
    return { ok: true, rows: data as ReconciliationRow[] };
  } catch {
    return { ok: false, reason: "query_failed" };
  }
}
