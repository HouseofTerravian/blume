# BLUME — NEXT ACTION
*The single next task. Do this, then update CURRENT_STATE + COMPLETED + this file.*

## ▶ Artifact / Router-Tag Spine (S1/S2) — the substrate for Lotus
**Wave:** 1 · **Systems:** S1 Artifact Engine + S2 Router-Tag Engine · **Deps:** BLUME-004/005 (DONE)
**Spec:** `build/ARTIFACT_SPINE_SPEC_v1.md` (build-ready — no further doctrine phase).

**Why now:** Lotus reads artifacts; the Spine must exist first. This is the last thing between BLUME and the FIRST LOTUS SCORE milestone.

**Minimum to satisfy the milestone path:**
- `thq_artifacts` table + `thq_vault_registry` (canonical vault slugs; integers legacy-compat). Storage prefix is **`thq_`** (matches live).
- Router-tag contract `{uuid, brand, vault, switch, title, timestamp, version, source, hash, metadata}` + a validator.
- Tools: `artifact_ingest` (auto-assign uuid/ts/version/hash/source + validate) and `artifact_list(brand, vault?, switch?)` — the exact call Lotus needs.
- (Per spec) `artifact_get`, `routertag_validate`, `vault_registry`; `artifact_migrate_legacy` (backfill `thq_vault_entries` by slug) can follow.

**Done when:** `artifact_ingest` returns a valid router-tagged artifact and `artifact_list(brand,…)` returns it back — i.e. Lotus has a sufficient substrate (spec §8 success criteria).

**Then:** Lotus Engine (S4) → **MILESTONE: FIRST LOTUS SCORE** → vault migration 8→12 (BLUME-032).

**Guardrails:** Doctrine + taxonomy FROZEN (ADR-004). Gate any new idea with *"Does this accelerate Lotus?"* — else defer. Don't touch Lotus until the Spine is done.
