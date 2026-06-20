/* Wave-2 Lotus depth test — bottleneck + missing-evidence. Run: tsx scripts/lotus-depth-smoke.ts */
import { ingestArtifact } from "../src/artifacts/store.js";
import { detectBottleneck, detectMissingEvidence } from "../src/lotus/engine.js";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };

// Empty brand: everything is missing; bottleneck is the first category.
const eb = await detectBottleneck("depth-empty");
ok(eb.category === "content" && eb.score === 0 && eb.band === "Dev", "empty brand bottleneck = content/0/Dev");
ok(eb.gapToNextBand === 50, `empty brand gapToNextBand = 50 (to Structuring) (got ${eb.gapToNextBand})`);
const em = await detectMissingEvidence("depth-empty");
ok(em.items.length === 5 && em.items.every(i => i.severity === "critical"), "empty brand → all 5 categories critical");

// Seed: content saturated, audience thin, offer/proof/monetization empty.
const B = "depth-smoke-brand";
const ing = (vault: string, sw: number | null, n: number) => {
  for (let i = 0; i < n; i++) ingestArtifact({ brand: B, title: `${vault}-${i}`, body: `x${i}`, vault, switch: sw ?? undefined });
};
ing("published-works", null, 4); // content = 20
ing("proof-of-use", 2, 1);       // switch 2 → audience = 5 ; also proof-of-use vault → proof = 5

const bn = await detectBottleneck(B);
// scores: content 20, audience 5, offer 0, proof 5, monetization 0 → lowest by order = offer
ok(bn.category === "offer" && bn.score === 0, `bottleneck = offer/0 (got ${bn.category}/${bn.score})`);
ok(bn.band === "Dev", `band = Dev (percent 30) (got ${bn.band})`);
ok(bn.gapToNextBand === 20, `gap to Structuring(50) = 20 (got ${bn.gapToNextBand})`);

const me = await detectMissingEvidence(B);
const byCat = Object.fromEntries(me.items.map(i => [i.category, i]));
ok(!("content" in byCat), "content (saturated) not flagged");
ok(byCat["offer"]?.severity === "critical" && byCat["monetization"]?.severity === "critical", "offer + monetization = critical (empty)");
ok(byCat["audience"]?.severity === "thin" && byCat["proof"]?.severity === "thin", "audience + proof = thin (score 5 < 10)");
ok(me.items[0].severity === "critical", "critical items sorted first");
ok(me.items.every(i => typeof i.suggestedArtifact === "string" && i.suggestedArtifact.length > 0), "every item has a suggestedArtifact");
console.log("sample suggestion:", byCat["offer"]?.suggestedArtifact);

console.log(`\nLOTUS DEPTH: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
