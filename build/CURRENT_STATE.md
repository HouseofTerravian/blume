# BLUME — CURRENT STATE
*Living snapshot. Update every session. Read this FIRST.*

## HANDOFF — 2026-06-19 (RE-BASELINED after coverage audit)
Current State : **Wave 1.** ⚠️ **BLUME is ALREADY BUILT** (not greenfield). Coverage audit done → `COVERAGE_REPORT_v1.md`. Ledger re-baselined; doctrine validated by as-built code.
Completed     : Doctrine (Q-1/Q-2/Q-3) + Build Ledger v1 + **Coverage Report v1** + re-baseline. Already-built (in code): MCP scaffold (both servers), 8 CORE vaults, 26 brands, switches, search, generation (post/AIDA/offer/email/SEO), publishing (gateway+scheduler+daemon), observability, **S20–S27 infra** (events/queue/workflows/approvals/listings/affiliate/gateway/signals).
Completed +   : **★ MILESTONE: FIRST LOTUS SCORE ACHIEVED (2026-06-20).** Plus BLUME-004/005, Artifact Spine (S1/S2/S3), Lotus (S4, BLUME-040–043). `src/artifacts/` + `src/lotus/`; `lotus_readiness(brand)` → C/A/O/P/M + Launch Readiness Index + band. tsc clean; 18/18 spine + 13/13 lotus smoke. **BLUME is now an intelligence system.**
In Progress   : none
Blocked       : none
Next Task     : **Chude's call** — natural pause point. Options: (a) **Wave-2 Lotus depth** (Health Bar, missing-evidence, bottleneck, Tick Maps, investor summary), (b) **BLUME-032** vault-tool migration 8→12, (c) wire generators → `artifact_ingest` so real content auto-feeds scores, (d) apply `migrations/0001_artifacts.sql` to live Supabase. All gate on *"Does this accelerate value now?"*
Usage note   : To score a real brand: `artifact_ingest` a few artifacts (or `artifact_migrate_legacy dry_run=false`) then `lotus_readiness(brand)`.
Specs ready  : **`build/ARTIFACT_SPINE_SPEC_v1.md`** (S1/S2) + **`build/LOTUS_ENGINE_SPEC_v1.md`** (S4) — build-ready. **PR #1 + PR #2 both MERGED to main.** Spec phase CLOSED.
★ Milestone   : **FIRST LOTUS SCORE** (`build/MILESTONE_FIRST_LOTUS_SCORE.md`) — brand gets C/A/O/P/M + Launch Readiness Index. = storage→intelligence crossing. **Lotus is the primary objective.**
Frozen       : **Doctrine + Taxonomy FROZEN (ADR-004)** — reopen only on a real implementation contradiction/flaw. Gate every proposal with *"Does this accelerate Lotus?"* — else defer.
Build order  : **BLUME-004 → BLUME-005 → Artifact Spine (S1/S2) → Lotus (S4) → Vault Migration 8→12.** Next sessions BUILD, not specify.
Known Risks   :
  - **Genuine missing keystones: ★ the Artifact/Router-Tag spine (S1/S2) THEN Lotus Engine (S4)** — these don't exist yet; everything else is mostly built. (Spine first — Lotus reads it.)
  - Storage prefix is **`thq_*`** (not blume_*/sapi_*); code vault integers permuted vs doctrine → registry keys on slug.
  - Doctrine-debt: public `dominion_rex`/`venus_protocol` modes still in generation tools (BLUME-005).
  - Voice RULED 6.19.26: public default = Calm·Premium·Intelligent·Helpful·Strategic; Mystic-Tech = private only; no real copywriter names.
  - In-flight `@terravian/blume` package migration (`terravian-mcp/src/adapters/blume.ts` baby bridge) — finish the split, don't fork.
  - Vault representation (physical vs logical) OPEN — default logical/views.
  - PR #1 (doctrine + ledger + coverage report) recommended for merge.

## Wave progress
- Wave 1 (Spine): scaffold/generation/publishing BUILT; **Lotus + artifact/router-tag spine NOT built** (true remaining spine).
- S20–S27 infra: BUILT/ADOPT.
