/**
 * Lotus Engine — Scoring & Readiness types (S4).
 * Spec: build/LOTUS_ENGINE_SPEC_v1.md. Reads artifacts via the Spine; owns no truth.
 */

export type CategoryName = "content" | "audience" | "offer" | "proof" | "monetization";

export interface SubScores {
  content: number;       // 0–20
  audience: number;      // 0–20
  offer: number;         // 0–20
  proof: number;         // 0–20
  monetization: number;  // 0–20
}

export interface ReadinessResult {
  brand: string;
  percent: number;       // 0–100 (Launch Readiness Index = Σ sub-scores)
  band: string;          // Go | Final-Prep | Structuring | Dev
  subScores: SubScores;
  artifactCount: number; // distinct artifact lineages considered
  generatedAt: string;   // ISO-8601
}

/** A scoring rule: an artifact qualifies if its vault slug ∈ vaults OR its switch ∈ switches. */
export interface CategoryRule {
  name: CategoryName;
  max: number;               // 20
  weightPerArtifact: number; // points per distinct qualifying artifact (saturates at max)
  vaults: string[];          // qualifying canonical vault slugs
  switches: number[];        // qualifying Sales Switch numbers
}

export interface BandRule {
  name: string;
  min: number;  // inclusive lower bound (percent)
}

export interface LotusConfig {
  version: string;
  categories: CategoryRule[];
  bands: BandRule[];
}

// ─── Wave-2 depth: guidance ────────────────────────────────────────────────

export interface BottleneckResult {
  brand: string;
  category: CategoryName;   // lowest-scoring category gating readiness
  score: number;            // its sub-score (0–20)
  band: string;             // current overall band
  gapToNextBand: number;    // index points needed to reach the next band (0 if already top)
  generatedAt: string;
}

export interface MissingEvidenceItem {
  category: CategoryName;
  score: number;
  severity: "critical" | "thin";  // critical = empty (0); thin = below half of max
  suggestedArtifact: string;      // what to add (derived from the rubric sources)
}

export interface MissingEvidenceResult {
  brand: string;
  items: MissingEvidenceItem[];   // critical first, then thinnest
  generatedAt: string;
}
