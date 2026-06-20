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

*(Next: Proof-of-Use on publish · BLUME-032 vault migration · Health Bar — Chude's call.)*
