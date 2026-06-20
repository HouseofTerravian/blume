/**
 * Recommendation Engine (S5) — types.
 * BLUME's doctrinal answer: "what should happen next?"
 * Composed from Lotus (readiness + bottleneck + missing-evidence) + the 7 Sales Switches.
 * Spec basis: BLUME-080 (core) + BLUME-081 (next-best-action per Sales Switch).
 */

import type { CategoryName } from "../lotus/types.js";

export interface RecommendedAction {
  priority: number;                                  // 1 = do first
  category: CategoryName;
  severity: "critical" | "thin" | "optimize";
  action: string;                                    // concrete next step (what to add)
  rationale: string;                                 // why — Sales Switch context
  salesSwitch: number;                               // the Switch this action serves
}

export interface Recommendation {
  brand: string;
  readiness: { percent: number; band: string };
  headline: string;                                  // one-line "what to do next"
  primaryAction: RecommendedAction | null;           // the single highest-leverage move
  actions: RecommendedAction[];                      // prioritized plan
  generatedAt: string;
}
