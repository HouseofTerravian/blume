/**
 * Lotus Engine (S4) — computes a brand's C/A/O/P/M sub-scores + Launch Readiness Index.
 * Stateless/derived: reads artifacts via the Spine, scores, returns. Owns no storage of truth.
 * Spec: build/LOTUS_ENGINE_SPEC_v1.md. Milestone: FIRST LOTUS SCORE.
 */

import { listArtifacts } from "../artifacts/store.js";
import type { Artifact } from "../artifacts/types.js";
import { LOTUS_CONFIG } from "./config.js";
import type {
  LotusConfig,
  CategoryRule,
  CategoryName,
  ReadinessResult,
  SubScores,
  BottleneckResult,
  MissingEvidenceResult,
  MissingEvidenceItem,
} from "./types.js";

const CATEGORY_LABEL: Record<CategoryName, string> = {
  content: "Content",
  audience: "Audience",
  offer: "Offer",
  proof: "Proof",
  monetization: "Monetization",
};

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

// ─── Wave-2 depth: guidance (bottleneck + missing-evidence) ─────────────────

/** Human hint for what artifact would lift a category, derived from its rubric sources. */
function suggestionFor(rule: CategoryRule): string {
  const parts: string[] = [];
  if (rule.vaults.length) parts.push(`vault: ${rule.vaults.join(" / ")}`);
  if (rule.switches.length) parts.push(`Sales Switch ${rule.switches.join("/")}`);
  const sources = parts.join(" or ");
  return `Add ${CATEGORY_LABEL[rule.name]} artifacts (${sources}).`;
}

/** The lowest-scoring category gating readiness, + how far to the next band. */
export function detectBottleneck(brand: string, cfg: LotusConfig = LOTUS_CONFIG): BottleneckResult {
  const r = computeReadiness(brand, cfg);

  // Lowest sub-score; ties broken by config (rubric) order.
  let category: CategoryName = cfg.categories[0].name;
  for (const rule of cfg.categories) {
    if (r.subScores[rule.name] < r.subScores[category]) category = rule.name;
  }

  // Points to the next-higher band (0 if already in the top band).
  const higher = cfg.bands
    .filter(b => b.min > r.percent)
    .sort((a, b) => a.min - b.min)[0];
  const gapToNextBand = higher ? higher.min - r.percent : 0;

  return {
    brand,
    category,
    score: r.subScores[category],
    band: r.band,
    gapToNextBand,
    generatedAt: new Date().toISOString(),
  };
}

/** Categories that are empty (critical) or thin (below half), with what would fill each. */
export function detectMissingEvidence(brand: string, cfg: LotusConfig = LOTUS_CONFIG): MissingEvidenceResult {
  const r = computeReadiness(brand, cfg);
  const items: MissingEvidenceItem[] = [];

  for (const rule of cfg.categories) {
    const score = r.subScores[rule.name];
    const threshold = rule.max / 2;
    if (score === 0) {
      items.push({ category: rule.name, score, severity: "critical", suggestedArtifact: suggestionFor(rule) });
    } else if (score < threshold) {
      items.push({ category: rule.name, score, severity: "thin", suggestedArtifact: suggestionFor(rule) });
    }
  }

  // Critical first, then by lowest score.
  items.sort((a, b) =>
    a.severity === b.severity ? a.score - b.score : a.severity === "critical" ? -1 : 1,
  );

  return { brand, items, generatedAt: new Date().toISOString() };
}
