# BLUME — NEXT ACTION
*The single next task. Do this, then update CURRENT_STATE + COMPLETED + this file.*

## ▶ LOTUS ENGINE (S4) — `lotus_readiness(brand)` = MILESTONE: FIRST LOTUS SCORE
**Wave:** 1 · **System:** S4 Lotus Engine · **Deps:** Artifact Spine (DONE)
**Spec:** `build/LOTUS_ENGINE_SPEC_v1.md` · **Milestone:** `build/MILESTONE_FIRST_LOTUS_SCORE.md`

**The Spine is ready.** `artifact_list(brand, vault?, switch?)` is live and returns the full router-tag contract — exactly Lotus's input (spec §8 hand-off satisfied). Lotus owns no storage; it reads artifacts and scores.

**Minimum to hit the milestone:**
- Scoring config (rubric): 5 categories × 20 = `Content · Audience · Offer · Proof · Monetization`, mapped to artifact sources (vault slug / switch) per Lotus spec §3 table.
- `lotus_readiness(brand)` → `{ percent, band, subScores{content,audience,offer,proof,monetization} }`.
- Bands: `Go ≥85 · Final-Prep 70–84 · Structuring 50–69 · Dev <50`.
- Reads via `listArtifacts({ brand, vault, switch })` from `src/artifacts/store.ts`.

**Done when:** a brand with seeded artifacts gets all 5 sub-scores + Launch Readiness Index from one `lotus_readiness` call. **That is the storage→intelligence crossing.**

**Defer (post-milestone Wave 2, do NOT build now):** Health Bar, missing-evidence, bottleneck, Tick Maps, investor summary, recommendation engine.

**To seed test data:** `artifact_ingest` a few artifacts across vaults/switches for a brand, or `artifact_migrate_legacy({ brand, dryRun:false })` to backfill existing vault entries.

**Guardrails:** Doctrine + taxonomy FROZEN (ADR-004). Gate every decision with *"Does this accelerate First Lotus Score?"* — else defer. Build only what `lotus_readiness` requires.
