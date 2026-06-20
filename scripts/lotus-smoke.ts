/* Lotus smoke test — proves FIRST LOTUS SCORE. Run: tsx scripts/lotus-smoke.ts */
import { ingestArtifact, versionArtifact } from "../src/artifacts/store.js";
import { computeReadiness } from "../src/lotus/engine.js";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };

// 1. Empty brand → graceful zero (Dev band)
const empty = computeReadiness("lotus-empty-brand");
ok(empty.percent === 0 && empty.band === "Dev", "empty brand → 0% / Dev band (graceful)");
ok(["content","audience","offer","proof","monetization"].every(k => (empty.subScores as any)[k] === 0), "empty brand → all 5 sub-scores = 0");

// 2. Seed a brand to a deterministic, known score
const B = "lotus-smoke-brand";
const ing = (vault: string, sw: number | null, n: number) => {
  for (let i = 0; i < n; i++) ingestArtifact({ brand: B, title: `${vault}-${sw}-${i}`, body: `x${i}`, vault, switch: sw ?? undefined });
};
ing("published-works", null, 4);    // content: 4*5 = 20 (saturated)
ing("proof-of-use", null, 2);       // audience: 2*5=10 ; proof: +2 lineages
ing("commerce-evidence", null, 4);  // offer 20 ; proof +4 ; monetization 20

const r = computeReadiness(B);
ok(r.subScores.content === 20, `content = 20 (got ${r.subScores.content})`);
ok(r.subScores.audience === 10, `audience = 10 (got ${r.subScores.audience})`);
ok(r.subScores.offer === 20, `offer = 20 (got ${r.subScores.offer})`);
ok(r.subScores.proof === 20, `proof = 20 — proof-of-use(2)+commerce(4)=6 lineages saturate (got ${r.subScores.proof})`);
ok(r.subScores.monetization === 20, `monetization = 20 (got ${r.subScores.monetization})`);
ok(r.percent === 90, `Launch Readiness Index = 90 (got ${r.percent})`);
ok(r.band === "Go", `band = Go (>=85) (got ${r.band})`);
ok(typeof r.generatedAt === "string", "result carries generatedAt");

// 3. Versioning must NOT inflate scores (distinct lineages only)
const V = "lotus-version-brand";
const { artifact } = ingestArtifact({ brand: V, title: "draft", body: "v1", vault: "published-works" });
versionArtifact(artifact.uuid, "v2");
versionArtifact(artifact.uuid, "v3");
const rv = computeReadiness(V);
ok(rv.subScores.content === 5, `3 versions of 1 artifact → content = 5, not 15 (got ${rv.subScores.content})`);
ok(rv.artifactCount === 1, `artifactCount counts 1 distinct lineage (got ${rv.artifactCount})`);

// 4. Band thresholds
const band = (p: number) => { const tmp = `lotus-band-${p}`; return { tmp, p }; };
ok(computeReadiness("nobody").band === "Dev", "unknown brand band = Dev");

console.log(`\nLOTUS SMOKE: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
