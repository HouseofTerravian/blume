/**
 * Read-only reconciliation report for the TPIG retrieval ledger. Run: npm run ledger:reconcile
 *
 * Reads public.thq_retrieval_reconciliation (SELECT only) with the service-role client and prints issue names, counts and
 * 8-character id prefixes. It never writes, never resolves anything, and never prints a database error message.
 *
 * Exit status: 0 nothing to act on (only informational pre_ledger_artifact rows) | 1 actionable issues | 2 could not read.
 */
import "dotenv/config";
import { getSupabase } from "../src/integrations/supabase.js";
import { fetchReconciliation, summarizeReconciliation } from "../src/signals/ledger/reconcile.js";

const result = await fetchReconciliation(getSupabase());
if (!result.ok) {
  console.error(
    result.reason === "no_client"
      ? "ledger-reconcile: database credentials are not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
      : "ledger-reconcile: the reconciliation query failed (details withheld).",
  );
  process.exit(2);
}

const summary = summarizeReconciliation(result.rows);
console.log(`ledger reconciliation: ${summary.total} row(s), ${summary.actionable} actionable`);
for (const [issue, n] of Object.entries(summary.byIssue).sort()) console.log(`  ${issue.padEnd(28)} ${n}`);
if (summary.lines.length) {
  console.log("");
  for (const line of summary.lines) console.log(line);
}
console.log(summary.actionable === 0 ? "\nnothing to act on." : "\nactionable issues above need a human decision; this tool changes nothing.");
process.exit(summary.actionable === 0 ? 0 : 1);
