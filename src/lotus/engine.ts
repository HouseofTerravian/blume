/**
 * Lotus Engine (S4) — computes a brand's C/A/O/P/M sub-scores + Launch Readiness Index.
 * Stateless/derived: reads artifacts via the Spine, scores, returns. Owns no storage of truth.
 * Spec: build/LOTUS_ENGINE_SPEC_v1.md. Milestone: FIRST LOTUS SCORE.
 */

import { listArtifacts } from "../artifacts/store.js";
import type { Artifact } from "../artifacts/types.js";
import { LOTUS_CONFIG } from "./config.js";
import type { LotusConfig, CategoryRule, ReadinessResult, SubScores } from "./types.js";

function qualifies(a: Artifact, rule: CategoryRule): boolean {
  if (rule.vaults.includes(a.vault)) return true;
  if (a.switch != null && rule.switches.includes(a.switch)) return true;
  return false;
}

/** Count distinct lineages (so versions don't inflate), then saturate at the category max. */
function scoreCategory(arts: Artifact[], rule: CategoryRule): number {
  const lineages = new Set<string>();
  for (const a of arts) {
    if (qualifies(a, rule)) lineages.add(a.parent_uuid ?? a.uuid);
  }
  return Math.min(rule.max, lineages.size * rule.weightPerArtifact);
}

function bandFor(percent: number, cfg: LotusConfig): string {
  for (const b of cfg.bands) {
    if (percent >= b.min) return b.name;
  }
  return cfg.bands[cfg.bands.length - 1]?.name ?? "Dev";
}

/** The milestone call. Returns the five sub-scores + Launch Readiness Index + band for a brand. */
export function computeReadiness(brand: string, cfg: LotusConfig = LOTUS_CONFIG): ReadinessResult {
  if (!brand || typeof brand !== "string") {
    throw new Error("lotus_readiness: 'brand' (slug) is required");
  }

  const arts = listArtifacts({ brand });

  const subScores: SubScores = {
    content: 0,
    audience: 0,
    offer: 0,
    proof: 0,
    monetization: 0,
  };
  for (const rule of cfg.categories) {
    subScores[rule.name] = scoreCategory(arts, rule);
  }

  const percent =
    subScores.content + subScores.audience + subScores.offer + subScores.proof + subScores.monetization;
  const distinct = new Set(arts.map(a => a.parent_uuid ?? a.uuid)).size;

  return {
    brand,
    percent,
    band: bandFor(percent, cfg),
    subScores,
    artifactCount: distinct,
    generatedAt: new Date().toISOString(),
  };
}

export function getLotusConfig(): LotusConfig {
  return LOTUS_CONFIG;
}
