# BLUME — CURRENT STATE
*Living snapshot. Update every session. Read this FIRST.*

## HANDOFF — 2026-06-19 (RE-BASELINED after coverage audit)
Current State : **Wave 1.** ⚠️ **BLUME is ALREADY BUILT** (not greenfield). Coverage audit done → `COVERAGE_REPORT_v1.md`. Ledger re-baselined; doctrine validated by as-built code.
Completed     : Doctrine (Q-1/Q-2/Q-3) + Build Ledger v1 + **Coverage Report v1** + re-baseline. Already-built (in code): MCP scaffold (both servers), 8 CORE vaults, 26 brands, switches, search, generation (post/AIDA/offer/email/SEO), publishing (gateway+scheduler+daemon), observability, **S20–S27 infra** (events/queue/workflows/approvals/listings/affiliate/gateway/signals).
Completed +   : **★ FIRST LOTUS SCORE achieved + Lotus now runs LIVE.** BLUME-004/005, Artifact Spine (S1/S2/S3), Lotus (S4), **generators→artifacts (S17, BLUME-200/202)**. `src/artifacts/` + `src/lotus/` + `src/content/ingestGenerated.ts`. Generating content now auto-updates `lotus_readiness` (verified live: generate→artifact→0%→5%). tsc clean; 18/18 spine + 13/13 lotus + 6/6 live-gen.
Extraction   : `@terravian/blume` dedup DONE (persona/switches/seo/vault = shims; ~627→~55 lines).
Lotus depth  : Wave-2 guidance DONE — `lotus_bottleneck` + `lotus_missing_evidence` (BLUME-053/054).
S5 Recommend : DONE — `recommend_next` (BLUME-080/081): Lotus + 7 Switches → prioritized plan + headline.
LIVE + TESTED : DDL applied to live Supabase `wxinipsficonhfifjqek` (thq_artifacts + thq_vault_registry, registry=12).
LIVE-READ ✓   : **`listArtifacts` Supabase-first + local fallback (2026-06-20).** Engine/handlers now async; reads live `thq_artifacts`, falls back to local on error/offline. Boundary unchanged (Lotus→listArtifacts→store→Supabase-first→local; Lotus never queries Supabase). No logic/doctrine change. **Acceptance: LIVE 10/10 "Supabase read path used" (local wiped) + OFFLINE 8/8 "local fallback"**; 4 smokes green offline. Fresh process scores live data without the local store.
RAW ✓        : **Read-after-write (2026-06-20).** `artifact_ingest` awaits the live mirror; throws on mirror failure (Supabase enabled) → never reports success until the row is in `thq_artifacts`. Local-only when disabled (fallback preserved). Write path async; no Lotus/Recommendation/doctrine/caching change. Acceptance polling REMOVED → LIVE 10/10 ("no poll") + OFFLINE 8/8.
PROOF ✓      : **Proof-of-Use on real publishes (2026-06-20).** Confirmed publishes auto-emit `proof-of-use` artifacts (`source=publish-confirmed`) capturing platform/external_post_id/external_url/published_at/content_hash/posting_account; gated on `external_post_id` (intent ≠ proof). `recordProofOfUse` in `@terravian/blume`; wired at terravian-mcp confirmation boundaries (generateAndTweet/generateAndPost/firePost, best-effort). Live constraint migration 0002 applied. Acceptance 14/14 (Lotus sees evidence via live Supabase read, no poll). No Lotus/Recommendation/taxonomy/doctrine change.
In Progress   : none
Blocked       : none
Next Task     : **Chude's ranking →** (1) ✅ await-live-mirror · (2) ✅ Proof-of-Use on real publishes · (3) ▶ **BLUME-032** vault-tool migration 8→12 · ⏸ Memory Vault · ⏸ Health Bar/Investor Summary. **Next = BLUME-032.**
Proof re-test: `VAULT_ROOT=./.proof npx tsx scripts/proof-acceptance.ts` (Supabase from .env).
How to re-test: LIVE `VAULT_ROOT=./.acc-live npx tsx scripts/acceptance.ts` · OFFLINE `SUPABASE_URL= VAULT_ROOT=./.acc-local npx tsx scripts/acceptance.ts`. Apply DDL: `supabase db query --linked --file migrations/0001_artifacts.sql`.
Usage note   : Generating content auto-feeds Lotus now. Manual seeding still available via `artifact_ingest` / `artifact_migrate_legacy dry_run=false`.
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
