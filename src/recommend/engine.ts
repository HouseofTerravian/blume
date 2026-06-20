/**
 * Recommendation Engine (S5) — "what should happen next?"
 *
 * Pure/derived: composes Lotus (readiness + bottleneck + missing-evidence) with the
 * 7 Sales Switches into a prioritized, switch-aware action plan. Owns no state.
 * BLUME-080 (core) + BLUME-081 (next-best-action per Sales Switch).
 */

import { computeReadiness, detectBottleneck, detectMissingEvidence } from "../lotus/engine.js";
import { SEVEN_SWITCHES } from "../content/switches.js";
import type { SwitchNumber } from "../content/switches.js";
import type { CategoryName } from "../lotus/types.js";
import type { Recommendation, RecommendedAction } from "./types.js";

const CATEGORY_LABEL: Record<CategoryName, string> = {
  content: "Content",
  audience: "Audience",
  offer: "Offer",
  proof: "Proof",
  monetization: "Monetization",
};

/** Which Sales Switch each readiness category primarily serves (recommendation layer only). */
const CATEGORY_SWITCH: Record<CategoryName, SwitchNumber> = {
  content: 3,      // Traffic
  audience: 2,     // Audience
  offer: 5,        // Conversion
  proof: 4,        // Connection / Trust
  monetization: 6, // Retention / Growth
};

function rationaleFor(category: CategoryName): string {
  const sw = CATEGORY_SWITCH[category];
  const info = SEVEN_SWITCHES[sw];
  return `Switch ${sw} — ${info.name}: ${info.focus}`;
}

export async function recommend(brand: string): Promise<Recommendation> {
  const readiness = await computeReadiness(brand);
  const bottleneck = await detectBottleneck(brand);
  const missing = await detectMissingEvidence(brand);

  const actions: RecommendedAction[] = [];
  let priority = 1;

  // 1. Missing-evidence items → concrete actions (already sorted critical-first, then thinnest).
  for (const item of missing.items) {
    actions.push({
      priority: priority++,
      category: item.category,
      severity: item.severity,
      action: item.suggestedArtifact,
      rationale: rationaleFor(item.category),
      salesSwitch: CATEGORY_SWITCH[item.category],
    });
  }

  // 2. No gaps but not maxed → deepen the bottleneck category (optimization).
  if (actions.length === 0 && readiness.percent < 100) {
    actions.push({
      priority: priority++,
      category: bottleneck.category,
      severity: "optimize",
      action: `Strengthen ${CATEGORY_LABEL[bottleneck.category]}: add more evidence to push it toward full marks.`,
      rationale: rationaleFor(bottleneck.category),
      salesSwitch: CATEGORY_SWITCH[bottleneck.category],
    });
  }

  // Primary = the action on the gating (bottleneck) category, else the first action.
  const primaryAction =
    actions.find(a => a.category === bottleneck.category) ?? actions[0] ?? null;

  return {
    brand,
    readiness: { percent: readiness.percent, band: readiness.band },
    headline: buildHeadline(readiness.percent, readiness.band, primaryAction),
    primaryAction,
    actions,
    generatedAt: new Date().toISOString(),
  };
}

function buildHeadline(
  percent: number,
  band: string,
  primary: RecommendedAction | null,
): string {
  if (!primary) {
    return percent >= 85
      ? `Launch-ready — ${percent}% (${band}). Maintain momentum and keep evidence fresh.`
      : `${band} — ${percent}%. No gaps detected.`;
  }
  return `${band} — ${percent}%. Biggest lever: ${CATEGORY_LABEL[primary.category]}. ${primary.action}`;
}
