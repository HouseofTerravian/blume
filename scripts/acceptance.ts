/**
 * BLUME ACCEPTANCE TEST — validates the complete intelligence loop AND the read path.
 *
 *   artifact_create → artifact_store → artifact_read
 *   → lotus_readiness → lotus_bottleneck → lotus_missing_evidence → recommend_next
 *
 * Two modes (selected by whether Supabase is enabled):
 *   • LIVE  (Supabase enabled): writes mirror to live thq_artifacts; the local store is then WIPED,
 *           so every subsequent read can ONLY come from Supabase → proves the Supabase-read path.
 *   • OFFLINE (Supabase disabled): data is local only → proves local fallback.
 *
 * Run both:
 *   VAULT_ROOT=./.acc-live  tsx scripts/acceptance.ts                 # LIVE  (Supabase from .env)
 *   SUPABASE_URL= VAULT_ROOT=./.acc-local tsx scripts/acceptance.ts   # OFFLINE (local fallback)
 *
 * Self-cleaning (live rows removed before+after). Clear PASS/FAIL + exit code.
 */
import fs from "fs";
import path from "path";
import { config } from "../src/config.js";
import { ingestArtifact, getArtifact, listArtifacts } from "../src/artifacts/store.js";
import { computeReadiness, detectBottleneck, detectMissingEvidence } from "../src/lotus/engine.js";
import { recommend } from "../src/recommend/engine.js";
import { getSupabase, isSupabaseEnabled, dbListArtifacts } from "../src/integrations/supabase.js";

const BRAND = "blume-acceptance";
const LIVE = isSupabaseEnabled();
const tag = LIVE ? "Supabase-read" : "local";
const results: { name: string; pass: boolean; detail?: string }[] = [];
const check = (name: string, pass: boolean, detail = "") => results.push({ name, pass, detail });

async function cleanupLive() {
  const sb = getSupabase();
  if (sb) await sb.from("thq_artifacts").delete().eq("brand", BRAND);
}
function localBrandDir() { return path.join(config.vault.root, "_artifacts", BRAND); }

async function main() {
  console.log(`\nMODE: ${LIVE ? "LIVE — Supabase enabled (proving Supabase-read path)" : "OFFLINE — Supabase disabled (proving local fallback)"}`);
  if (LIVE) await cleanupLive(); // isolation

  // ── artifact_create + artifact_store (local primary + live thq_artifacts mirror when LIVE) ──
  await ingestArtifact({ brand: BRAND, title: "pw1", body: "alpha", vault: "published-works" });
  await ingestArtifact({ brand: BRAND, title: "pw2", body: "beta", vault: "published-works" });
  const ce = await ingestArtifact({ brand: BRAND, title: "ce1", body: "gamma", vault: "commerce-evidence" });
  check("artifact_create → router-tagged artifact (uuid + sha256)", !!ce.artifact.uuid && ce.artifact.hash.length === 64);

  if (LIVE) {
    // ingest already AWAITED the live mirror (read-after-write) → rows are present immediately, NO polling.
    const liveRows = await dbListArtifacts({ brand: BRAND });
    check("artifact WRITES are in live thq_artifacts immediately after ingest (no poll)", liveRows.length === 3, `got ${liveRows.length}`);
    check("artifact READS from live return matching uuid + hashes", liveRows.some(r => r.uuid === ce.artifact.uuid) && liveRows.every(r => (r.hash?.length ?? 0) === 64));

    // PROOF: wipe the local store so any further read can ONLY come from Supabase.
    fs.rmSync(localBrandDir(), { recursive: true, force: true });
    check("local store WIPED (getArtifact → null)", getArtifact(ce.artifact.uuid, BRAND) === null);
    const viaStore = await listArtifacts({ brand: BRAND });
    check("listArtifacts reads from Supabase after local wipe (3)", viaStore.length === 3, `got ${viaStore.length}`);
  } else {
    // OFFLINE: data exists only in the local store.
    check("artifact READS from local (getArtifact round-trips)", getArtifact(ce.artifact.uuid, BRAND)?.hash === ce.artifact.hash);
    const viaStore = await listArtifacts({ brand: BRAND });
    check("listArtifacts reads from local fallback (3)", viaStore.length === 3, `got ${viaStore.length}`);
  }

  // ── The engine — uses listArtifacts (Supabase-first when LIVE, local when OFFLINE) ──
  const r = await computeReadiness(BRAND);
  check(`lotus_readiness = 25% / Dev  [${tag}]`, r.percent === 25 && r.band === "Dev", `${r.percent}/${r.band}`);
  check("lotus_readiness sub-scores (C10 A0 O5 P5 M5)",
    r.subScores.content === 10 && r.subScores.audience === 0 && r.subScores.offer === 5 && r.subScores.proof === 5 && r.subScores.monetization === 5,
    JSON.stringify(r.subScores));

  const b = await detectBottleneck(BRAND);
  check(`lotus_bottleneck = audience / 0  [${tag}]`, b.category === "audience" && b.score === 0, `${b.category}/${b.score}`);

  const m = await detectMissingEvidence(BRAND);
  check(`lotus_missing_evidence = 1 critical + 3 thin  [${tag}]`,
    m.items.length === 4 && m.items.find(i => i.category === "audience")?.severity === "critical" && !m.items.map(i => i.category).includes("content"),
    `items=${m.items.length}`);

  const rec = await recommend(BRAND);
  check(`recommend_next primary = audience  [${tag}]`, rec.primaryAction?.category === "audience" && rec.actions.length > 0 && rec.headline.length > 0);

  if (LIVE) await cleanupLive(); // leave no test data in live
  report();
}

function report() {
  console.log("\n────────── BLUME ACCEPTANCE TEST ──────────");
  for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.name}${!r.pass && r.detail ? `  [${r.detail}]` : ""}`);
  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  console.log("\nLOOP: artifact_create → store → read → lotus_readiness → bottleneck → missing_evidence → recommend_next");
  const pathName = LIVE ? "Supabase read path" : "local fallback path";
  console.log(`\n  RESULT: ${failed === 0 ? `PASS ✅ — ${pathName} used` : "FAIL ❌"}  (${passed}/${results.length} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ACCEPTANCE ERROR:", e?.message ?? e);
  try { await cleanupLive(); } catch { /* ignore */ }
  console.log("\n  RESULT: FAIL ❌ (threw)");
  process.exit(1);
});
