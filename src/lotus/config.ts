/**
 * Lotus scoring rubric v1 (declarative, tunable — BLUME-040).
 * Each category maxes at 20; full marks at `20 / weightPerArtifact` distinct qualifying artifacts.
 * Category→source mapping per LOTUS_ENGINE_SPEC_v1.md §3.
 * Launch Readiness Index = Σ of the five 0–20 sub-scores = 0–100.
 */

import type { LotusConfig } from "./types.js";

export const LOTUS_CONFIG: LotusConfig = {
  version: "v1",
  categories: [
    { name: "content",      max: 20, weightPerArtifact: 5, vaults: ["published-works", "creative-drafts"], switches: [3] },
    { name: "audience",     max: 20, weightPerArtifact: 5, vaults: ["proof-of-use"],                        switches: [2] },
    { name: "offer",        max: 20, weightPerArtifact: 5, vaults: ["commerce-evidence"],                   switches: [5] },
    { name: "proof",        max: 20, weightPerArtifact: 5, vaults: ["proof-of-use", "commerce-evidence"],   switches: [] },
    { name: "monetization", max: 20, weightPerArtifact: 5, vaults: ["commerce-evidence", "investor"],       switches: [] },
  ],
  bands: [
    { name: "Go",          min: 85 },
    { name: "Final-Prep",  min: 70 },
    { name: "Structuring", min: 50 },
    { name: "Dev",         min: 0 },
  ],
};
