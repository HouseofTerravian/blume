# BLUME — COMPLETED (append-only done log)
*Format: `BLUME-### · YYYY-MM-DD · <commit-sha> · <one-line result>`. Newest at bottom.*

---
- FOUNDATION · 2026-06-19 · (pending merge) · Doctrine locked (Q-1/Q-2/Q-3) — `docs/doctrine/blume-q1-q2-q3-resolution.md`
- FOUNDATION · 2026-06-19 · (this commit) · Build Ledger v1 created — `build/BUILD_LEDGER.md` + state files

- BLUME-004 · 2026-06-19 · (prev commit) · Reconciled both servers vs ledger — 27 systems verified (BUILT/PARTIAL/MISSING/OBSOLETE); see BUILD_LEDGER §5b. Confirmed S1/S2 Spine + S4 Lotus MISSING.
- BLUME-005 · 2026-06-19 · (this commit) · Voice cleanup: retired `dominion_rex`/`venus_protocol` from public (private/House-only); public default = calm-premium (Calm·Premium·Intelligent·Helpful·Strategic); `resolvePublicMode` fallback for old callers. Both repos type-check clean. Files: persona.ts/generator.ts/index.ts/server.ts/cli.ts ×2 repos.

- SPINE (S1/S2/S3) · 2026-06-19 · (this commit) · Artifact/Router-Tag Spine BUILT — `src/artifacts/` (types/registry/routerTag/store/migrate) + `migrations/0001_artifacts.sql` + 6 MCP tools (artifact_ingest/list/get, routertag_validate, vault_registry, artifact_migrate_legacy). Closes BLUME-002,003,010,011,020,021,030,031,050,072. tsc clean; 18/18 smoke assertions. Lotus-ready.

- LOTUS (S4) · 2026-06-20 · (this commit) · ★ **MILESTONE: FIRST LOTUS SCORE achieved.** `src/lotus/` (types/config/engine) + `lotus_readiness`/`lotus_score_config`. C/A/O/P/M (0–20 each) → Launch Readiness Index (0–100) + bands. Closes BLUME-040/041/042/043. tsc clean; 13/13 smoke (seeded brand → 90%/Go). BLUME = intelligence system.

- S17→Spine · 2026-06-20 · (this commit) · Generators wired to `artifact_ingest` — Lotus runs LIVE. `src/content/ingestGenerated.ts` + generator.ts/seo.ts. Drafts→Creative Drafts, approved→Published Works; best-effort (never breaks generation). Closes BLUME-200/202. Live test 6/6: real generatePost → artifact → lotus 0%→5%.

- EXTRACT · 2026-06-20 · (this commit) · `@terravian/blume` extraction — deduped persona/switches/seo/vault in terravian-mcp to re-export shims (~627 lines → ~55); logic now lives once in the package. Added `resolvePublicMode`+mode consts to blume `index.ts` exports; declared `@terravian/blume: file:../blume`. tsc clean both repos; 8/8 runtime boundary check. Generation orchestration + brand store stay local (behavior-preserving).

- LOTUS-DEPTH (S4) · 2026-06-20 · (this commit) · Wave-2 guidance: `lotus_bottleneck` + `lotus_missing_evidence` (`src/lotus/engine.ts` + types). Lowest gating category + gap-to-next-band; empty/thin categories + suggested artifact. Closes BLUME-053/054. tsc clean; 11/11 smoke. Score → guidance.

- RECOMMEND (S5) · 2026-06-20 · (this commit) · Recommendation Engine: `recommend_next` (`src/recommend/`). Composes Lotus readiness+bottleneck+missing-evidence + 7 Sales Switches → prioritized switch-aware plan + headline + primary action. Closes BLUME-080/081 (082 blocked on Memory). tsc clean; 13/13 smoke. BLUME now answers "what should happen next?"

- LIVE-MIGRATION + ACCEPTANCE · 2026-06-20 · (this commit) · Applied `0001_artifacts.sql` to live Supabase `wxinipsficonhfifjqek` (`supabase db query --linked`); registry=12, thq_artifacts live. Added `scripts/acceptance.ts` — full-loop acceptance test (create→store→read(local+live)→readiness→bottleneck→missing→recommend), self-cleaning, PASS/FAIL. **Result: PASS 13/13.** Closes BLUME-002 (DDL live).

- LIVE-READ (reliability) · 2026-06-20 · (this commit) · `listArtifacts` now Supabase-first + local fallback (`dbReadArtifacts` null-on-error). Engine (`computeReadiness`/`detectBottleneck`/`detectMissingEvidence`/`recommend`) + handlers made async to await the read. Boundary unchanged (Lotus→listArtifacts→store→Supabase-first→local). No logic/doctrine change. Acceptance: LIVE 10/10 ("Supabase read path used", local wiped) + OFFLINE 8/8 ("local fallback"); 4 smokes green offline. Fresh process scores live data with no local store.

- READ-AFTER-WRITE (reliability) · 2026-06-20 · (this commit) · `artifact_ingest` awaits the live mirror; throws on mirror failure (Supabase enabled) so it never reports success until the row is in `thq_artifacts`. Local-only when disabled (fallback preserved). `persistArtifact`/`ingestArtifact`/`versionArtifact`/`migrate`/`ingestGenerated` + generators async; handlers await. No Lotus/Recommendation/doctrine/caching change. Acceptance polling REMOVED: LIVE 10/10 ("no poll") + OFFLINE 8/8; 4 smokes green.

- PROOF-OF-USE (S13, evidentiary) · 2026-06-20 · (this commit) · Confirmed external publishes auto-emit Proof-of-Use artifacts. New source `publish-confirmed` (+ live constraint migration 0002); `recordProofOfUse` in `@terravian/blume` captures platform/external_post_id/external_url/published_at/brand/content_hash/posting_account via the read-after-write spine; gated on `external_post_id` (intent ≠ proof). Wired at terravian-mcp confirmation boundaries (generateAndTweet/generateAndPost/firePost) best-effort. Closes BLUME-150/151. Acceptance 14/14 (Lotus sees evidence via live Supabase read, no poll) + wire-smoke 3/3. No Lotus/Recommendation/taxonomy/doctrine change.

- BLUME-032 (S3, vault migration) · 2026-06-20 · (this commit) · Vault module migrated 8→12: derives from the canonical registry (slug canonical, integers legacy-compat; 1–8 meaning preserved, names aligned to legal/investor; +9 R&D/11 Memory/12 Library; 10 Compliance parked). init/summary/search/db span 12; blume + terravian-mcp vault tool ranges → 1–12. thq_vault_entries empty → no data migration. tsc clean both repos; vault-migration-smoke 17/17; no regression (proof 14/14, acceptance 10/10+8/8).

- WAVE-1 INTEGRITY AUDIT · 2026-06-20 · (audit only) · Full loop verified end-to-end. Suite GREEN: blume spine 18 / lotus 13 / depth 11 / recommend 13 / vault-migration 17 / acceptance LIVE 10 + OFFLINE 8 / proof LIVE 14; terravian-mcp tsc clean, extract-smoke 8 (fixed 1 stale 8→12 vault assertion, PR#5), proof-wire 3. Live DB: artifacts 0, registry 12, vault_entries 0, source-CHECK incl `publish-confirmed`. **Finding (non-blocking):** terravian-mcp's embedded `generateAndPost`/`generateAndTweet` emit Proof-of-Use on publish but do NOT ingest draft artifacts (`ingestGenerated` lives only in the blume-package generator — generation orchestration wasn't part of the @terravian/blume extraction). Loop is coherent at the DATA layer (all paths → shared `thq_artifacts`; Lotus reads it). **Verdict: Wave-1 = COMPLETE.**

*(Deferred: ⏸ Memory Vault (S8) · ⏸ Health Bar/Investor Summary. Future consolidation (not Wave-1): unify the two generators so terravian-mcp generation also auto-ingests drafts.)*
