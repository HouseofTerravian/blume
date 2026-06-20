/* S5 Recommendation Engine test. Run: tsx scripts/recommend-smoke.ts */
import { ingestArtifact } from "../src/artifacts/store.js";
import { recommend } from "../src/recommend/engine.js";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };

// 1. Empty brand → every category is a critical action; primary = the gating (content) category.
const er = await recommend("rec-empty");
ok(er.actions.length === 5 && er.actions.every(a => a.severity === "critical"), "empty brand → 5 critical actions");
ok(er.primaryAction?.category === "content", "empty brand primary = content (gating)");
ok(er.actions.every(a => a.salesSwitch >= 1 && a.salesSwitch <= 7 && a.rationale.includes("Switch")), "every action has a Sales Switch + rationale");
ok(er.actions.every((a, i) => a.priority === i + 1), "actions are priority-ordered 1..n");
ok(er.headline.includes("Dev") && er.headline.includes("0%"), "headline reflects Dev/0%");

// 2. Seeded brand: content saturated, others empty/thin → primary tracks the bottleneck.
const B = "rec-smoke-brand";
const ing = (vault: string, sw: number | null, n: number) => {
  for (let i = 0; i < n; i++) ingestArtifact({ brand: B, title: `${vault}-${i}`, body: `x${i}`, vault, switch: sw ?? undefined });
};
ing("published-works", null, 4); // content = 20
ing("proof-of-use", 2, 1);       // audience = 5 (thin), proof = 5 (thin)

const r = await recommend(B);
// scores: content 20, audience 5, offer 0, proof 5, monetization 0 → bottleneck offer
ok(r.primaryAction?.category === "offer" && r.primaryAction?.severity === "critical", "primary = offer/critical (the bottleneck)");
ok(r.actions.find(a => a.category === "content") === undefined, "saturated content yields no action");
ok(r.actions[0].severity === "critical", "critical actions ranked first");
ok(r.primaryAction!.salesSwitch === 5, "offer action maps to Sales Switch 5 (Conversion)");
ok(r.headline.startsWith("Dev — 30%"), `headline = Dev — 30% (got "${r.headline.slice(0, 24)}")`);
console.log("headline:", r.headline);

// 3. Fully-saturated brand → launch-ready, no actions.
const F = "rec-full-brand";
const ingF = (vault: string, sw: number | null, n: number) => {
  for (let i = 0; i < n; i++) ingestArtifact({ brand: F, title: `${vault}-${i}`, body: `y${i}`, vault, switch: sw ?? undefined });
};
ingF("published-works", null, 4);   // content 20
ingF("proof-of-use", 2, 4);         // audience 20 (switch 2) + proof 20 (vault)
ingF("commerce-evidence", null, 4); // offer 20 + monetization 20

const fr = await recommend(F);
ok(fr.readiness.percent === 100 && fr.readiness.band === "Go", "full brand → 100% / Go");
ok(fr.actions.length === 0 && fr.primaryAction === null, "full brand → no actions");
ok(fr.headline.startsWith("Launch-ready"), "full brand → Launch-ready headline");

console.log(`\nRECOMMEND: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
