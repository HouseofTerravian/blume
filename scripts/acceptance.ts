/**
 * BLUME ACCEPTANCE TEST — validates the complete intelligence loop against LIVE Supabase.
 *
 *   artifact_create → artifact_store → artifact_read (local + live thq_artifacts)
 *   → lotus_readiness → lotus_bottleneck → lotus_missing_evidence → recommend_next
 *
 * Run with the live DB in the loop (Supabase enabled from .env) + a throwaway local store:
 *   VAULT_ROOT=./.acceptance tsx scripts/acceptance.ts
 *
 * Self-cleaning: deletes its test brand's rows from live thq_artifacts before and after.
 * Clear PASS/FAIL + exit code.
 */
import { ingestArtifact, getArtifact } from "../src/artifacts/store.js";
import { computeReadiness, detectBottleneck, detectMissingEvidence } from "../src/lotus/engine.js";
import { recommend } from "../src/recommend/engine.js";
import { getSupabase, isSupabaseEnabled, dbListArtifacts } from "../src/integrations/supabase.js";

const BRAND = "blume-acceptance";
const results: { name: string; pass: boolean; detail?: string }[] = [];
const check = (name: string, pass: boolean, detail = "") => results.push({ name, pass, detail });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function cleanupLive() {
  const sb = getSupabase();
  if (sb) await sb.from("thq_artifacts").delete().eq("brand", BRAND);
}

async function main() {
  check("Supabase enabled (live DB in the loop)", isSupabaseEnabled());
  if (!isSupabaseEnabled()) return report();

  await cleanupLive(); // isolation

  // ── artifact_create + artifact_store (local primary + live thq_artifacts mirror) ──
  ingestArtifact({ brand: BRAND, title: "pw1", body: "alpha", vault: "published-works" });
  ingestArtifact({ brand: BRAND, title: "pw2", body: "beta", vault: "published-works" });
  const ce = ingestArtifact({ brand: BRAND, title: "ce1", body: "gamma", vault: "commerce-evidence" });
  check("artifact_create → router-tagged artifact (uuid + sha256)", !!ce.artifact.uuid && ce.artifact.hash.length === 64);

  // ── artifact_read (local round-trip) ──
  const local = getArtifact(ce.artifact.uuid, BRAND);
  check("artifact_read (local) round-trips body + hash", !!local && local.hash === ce.artifact.hash);

  // ── artifact write + read against LIVE thq_artifacts (poll for async mirror) ──
  let live: Awaited<ReturnType<typeof dbListArtifacts>> = [];
  for (let i = 0; i < 12; i++) { live = await dbListArtifacts({ brand: BRAND }); if (live.length >= 3) break; await sleep(500); }
  check("artifact WRITES landed in live thq_artifacts (3)", live.length === 3, `got ${live.length}`);
  check("artifact READS from live return matching uuid + hashes", live.some(r => r.uuid === ce.artifact.uuid) && live.every(r => (r.hash?.length ?? 0) === 64));

  // ── lotus_readiness ──
  const r = computeReadiness(BRAND);
  check("lotus_readiness = 25% / Dev", r.percent === 25 && r.band === "Dev", `${r.percent}/${r.band}`);
  check("lotus_readiness sub-scores (C10 A0 O5 P5 M5)",
    r.subScores.content === 10 && r.subScores.audience === 0 && r.subScores.offer === 5 && r.subScores.proof === 5 && r.subScores.monetization === 5,
    JSON.stringify(r.subScores));

  // ── lotus_bottleneck ──
  const b = detectBottleneck(BRAND);
  check("lotus_bottleneck = audience / 0", b.category === "audience" && b.score === 0, `${b.category}/${b.score}`);

  // ── lotus_missing_evidence ──
  const m = detectMissingEvidence(BRAND);
  const cats = m.items.map(i => i.category);
  check("missing_evidence: audience = critical", m.items.find(i => i.category === "audience")?.severity === "critical");
  check("missing_evidence: content (10) not flagged", !cats.includes("content"));
  check("missing_evidence: 4 items (1 critical + 3 thin)", m.items.length === 4, `got ${m.items.length}`);

  // ── recommend_next ──
  const rec = recommend(BRAND);
  check("recommend_next primary = audience (the bottleneck)", rec.primaryAction?.category === "audience");
  check("recommend_next has prioritized actions + headline", rec.actions.length > 0 && rec.headline.length > 0);

  await cleanupLive(); // leave no test data in live
  report();
}

function report() {
  console.log("\n────────── BLUME ACCEPTANCE TEST ──────────");
  for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.name}${!r.pass && r.detail ? `  [${r.detail}]` : ""}`);
  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  console.log("\nLOOP: artifact_create → store → read(local+live) → lotus_readiness → bottleneck → missing_evidence → recommend_next");
  console.log(`\n  RESULT: ${failed === 0 ? "PASS ✅" : "FAIL ❌"}  (${passed}/${results.length} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ACCEPTANCE ERROR:", e?.message ?? e);
  try { await cleanupLive(); } catch { /* ignore */ }
  console.log("\n  RESULT: FAIL ❌ (threw)");
  process.exit(1);
});
