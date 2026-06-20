/* Live wiring test: generate → artifact exists → lotus_readiness changes.
   Run isolated: SUPABASE_URL= VAULT_ROOT=./.gen-smoke tsx scripts/generate-live-smoke.ts */
import { generatePost } from "../src/content/generator.js";
import { listArtifacts } from "../src/artifacts/store.js";
import { computeReadiness } from "../src/lotus/engine.js";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const BRAND = process.env.SMOKE_BRAND || "mrmetaphysical";

const before = computeReadiness(BRAND);
console.log(`before: ${before.percent}%`, JSON.stringify(before.subScores));

const post = await generatePost({ brand: BRAND, platform: "twitter", goal: "awareness" });
console.log("generated:", JSON.stringify(post.content).slice(0, 120));

ok(typeof post.content === "string" && post.content.length > 0, "generatePost still returns content");
ok(post.platform === "twitter" && typeof post.characterCount === "number" && "approved" in post, "post output format preserved");

const arts = listArtifacts({ brand: BRAND });
const gen = arts.find(a => (a.metadata as Record<string, unknown>)?.generated === true);
ok(!!gen, "a generated artifact now exists (no manual ingest)");
ok(gen?.vault === "creative-drafts" && gen?.source === "blume-generated", "draft → Creative Drafts / source blume-generated");
ok((gen?.hash?.length ?? 0) === 64 && (gen?.uuid?.length ?? 0) >= 32, "artifact carries sha256 hash + uuid");

const after = computeReadiness(BRAND);
console.log(`after:  ${after.percent}%`, JSON.stringify(after.subScores));
ok(after.percent > before.percent, `lotus_readiness changed ${before.percent} → ${after.percent}`);

console.log(`\nLIVE GEN→LOTUS: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
