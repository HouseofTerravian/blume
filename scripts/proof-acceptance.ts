/**
 * PROOF-OF-USE ACCEPTANCE TEST — confirmed publication → durable evidence, Lotus-visible live.
 *
 * Simulates the publish-confirmed boundary (platform confirmation payload — no real external post)
 * and proves the evidence chain end-to-end against live Supabase:
 *   confirmation → recordProofOfUse → proof-of-use artifact → live thq_artifacts → Lotus reads it.
 *
 * Run: VAULT_ROOT=./.proof npx tsx scripts/proof-acceptance.ts   (Supabase enabled from .env)
 * Self-cleaning. Clear PASS/FAIL.
 */
import fs from "fs";
import path from "path";
import { config } from "../src/config.js";
import { computeHash } from "../src/artifacts/routerTag.js";
import { recordProofOfUse } from "../src/proof/index.js";
import { computeReadiness } from "../src/lotus/engine.js";
import { getSupabase, isSupabaseEnabled, dbListArtifacts } from "../src/integrations/supabase.js";

const BRAND = "blume-proof-acceptance";
const results: { name: string; pass: boolean; detail?: string }[] = [];
const check = (name: string, pass: boolean, detail = "") => results.push({ name, pass, detail });

async function cleanupLive() {
  const sb = getSupabase();
  if (sb) await sb.from("thq_artifacts").delete().eq("brand", BRAND);
}
function localBrandDir() { return path.join(config.vault.root, "_artifacts", BRAND); }

async function main() {
  check("Supabase enabled (live DB in the loop)", isSupabaseEnabled());
  if (!isSupabaseEnabled()) return report();
  await cleanupLive();

  // ── intent ≠ proof: no external_post_id → no artifact ──
  const none = await recordProofOfUse({ brand: BRAND, platform: "twitter", external_post_id: "", content: "draft only" });
  check("intent ≠ proof: no external_post_id → no artifact", none === null);

  // ── confirmed publication → Proof-of-Use artifact ──
  const content = "Real published post — confirmed by platform.";
  const pub = {
    brand: BRAND,
    platform: "twitter",
    external_post_id: "1799000000000000001",
    external_url: "https://twitter.com/i/web/status/1799000000000000001",
    posting_account: "@terravian_brand",
    content,
  };
  const art = await recordProofOfUse(pub);
  check("recordProofOfUse → artifact emitted", !!art);
  if (!art) return report();

  // ── evidence capture (a hostile auditor's checklist) ──
  check("✓ source = publish-confirmed", art.source === "publish-confirmed");
  check("✓ vault = proof-of-use", art.vault === "proof-of-use");
  check("✓ Platform recorded", art.metadata.platform === "twitter");
  check("✓ External ID recorded", art.metadata.external_post_id === pub.external_post_id);
  check("✓ URL recorded", art.metadata.external_url === pub.external_url);
  check("✓ Timestamp recorded", typeof art.metadata.published_at === "string" && !Number.isNaN(Date.parse(String(art.metadata.published_at))));
  check("✓ Posting account recorded", art.metadata.posting_account === pub.posting_account);
  check("✓ Hash recorded (= sha256 of content)", art.hash === computeHash(content) && art.metadata.content_hash === art.hash);
  check("✓ router-tag intact (uuid + version + timestamp)", !!art.uuid && art.version === 1 && !!art.timestamp);

  // ── Lotus sees the evidence via the LIVE Supabase read path (local wiped, no polling) ──
  fs.rmSync(localBrandDir(), { recursive: true, force: true });
  const live = await dbListArtifacts({ brand: BRAND });
  check("evidence is in live thq_artifacts immediately (no poll)", live.length === 1 && live[0].uuid === art.uuid, `rows=${live.length}`);
  const r = await computeReadiness(BRAND);
  check("✓ Lotus sees evidence via Supabase read (Proof score > 0, local wiped)", r.subScores.proof > 0, `proof=${r.subScores.proof}`);

  await cleanupLive();
  report();
}

function report() {
  console.log("\n────────── PROOF-OF-USE ACCEPTANCE ──────────");
  for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.name}${!r.pass && r.detail ? `  [${r.detail}]` : ""}`);
  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  console.log("\nCHAIN: confirmation → recordProofOfUse → proof-of-use artifact → live thq_artifacts → Lotus read");
  console.log(`\n  RESULT: ${failed === 0 ? "PASS ✅ — durable evidence of real publication" : "FAIL ❌"}  (${passed}/${results.length})`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("PROOF ACCEPTANCE ERROR:", e?.message ?? e);
  try { await cleanupLive(); } catch { /* ignore */ }
  console.log("\n  RESULT: FAIL ❌ (threw)");
  process.exit(1);
});
