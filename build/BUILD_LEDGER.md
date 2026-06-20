# BLUME Build Ledger v1
**Status:** Canonical implementation roadmap · created June 19, 2026
**Authority:** Doctrine locked (`docs/doctrine/blume-q1-q2-q3-resolution.md`); build gate OPEN.
**Purpose:** Let BLUME be resumed by *any* future Claude session after *any* gap, with near-zero context loss.

> ## ⏩ HOW TO RESUME (read this first, every session)
> 1. Read **`build/CURRENT_STATE.md`** — where we are (wave, last done, in-progress, blocked).
> 2. Read **`build/NEXT_ACTION.md`** — the single next task to execute.
> 3. Skim **`build/ARCHITECTURE.md`** — the locked invariants you must not violate.
> 4. Pick up the task by its **BLUME-### ID** from the Master Task Table below. Do one task per focused session.
> 5. On finish: append to **`build/COMPLETED.md`**, update `CURRENT_STATE.md` + `NEXT_ACTION.md`, set task status here to `DONE`.
> **You never need to reread the whole project.** "Resume from BLUME-047" must Just Work.

---

## 1. Architecture Invariants (do not violate — full detail in ARCHITECTURE.md / doctrine)
- **Constitutional Layer:** Vaults = *what happened* · Lotus = *how healthy* · BLUME = *what next* · Terravian-MCP = *where to go*. BLUME reads every vault, **owns none**.
- **Structural Principle:** `Owner → Holding → Brand → Artifact`. Vaults are **category lenses**, not ownership entities, not top-level.
- **Router-tag contract** (the BLUME-MCP ↔ Terravian-MCP interface): `{ uuid, brand, vault, switch, title, timestamp, version, source, hash, metadata }`.
- **MCP boundary:** BLUME-MCP owns taxonomy + router-tag + **Lotus (all scoring/readiness)** + sales switches + intelligence. Terravian-MCP owns cross-brand routing + ownership/permission (SlateRiver root → future TFT/TDT).
- **Open architectural calls (do not pre-decide):** vault representation physical-vs-logical (lean: artifacts-first / views); Compliance vault under review (reeval Sep–Dec 2026).

---

## 2. Systems Catalog
| Sys | Name | Owner | Role |
|-----|------|-------|------|
| S0  | Foundation (MCP scaffold + Storage) | BLUME-MCP | Server, transport, DB substrate |
| S1  | Artifact Engine | BLUME-MCP | Ingest + store the atomic unit |
| S2  | Router-Tag Engine | BLUME-MCP | The metadata contract + validation |
| S3  | Vault Engine | BLUME-MCP | Category lenses over artifacts |
| S4  | Lotus Engine (incl. Readiness) | BLUME-MCP | Scoring & Readiness Framework |
| S5  | Recommendation Engine | BLUME-MCP | "What should happen next" |
| S6  | Sales Switch Engine | BLUME-MCP | 7 switches + switch→vault map |
| S7  | Brand Engine | BLUME-MCP | owner→holding→brand registry |
| S8  | Memory Engine (Vault 11) | BLUME-MCP | Institutional memory |
| S9  | Library Engine (Vault 12) | Sovereign | Trustee-only lineage (TFT) |
| S10 | Investor Engine (Vault 8) | BLUME-MCP | Investor readiness artifacts |
| S11 | Search Engine | BLUME-MCP | Query/retrieval across artifacts |
| S12 | Audit Engine | BLUME-MCP | Proof-of-commerce, immutable log |
| S13 | Publishing & Distribution | shared | Publish + schedule (social/email) → proof-of-use |
| S14 | Identity Integration | shared | Noo World auth; trustee roles |
| S15 | Terravian-MCP Integration | Terravian-MCP | Routing + ownership/permission |
| S16 | Observability / Ops | BLUME-MCP | Logging, health, visibility |
| S17 | Content & Copywriting Engine | BLUME-MCP | Generate marketing copy/content (posts, emails, pages, ads) |
| S18 | Voice / Persona Engine | BLUME-MCP | BLUME's **voices** — selectable tones/personas + A/B voice testing |
| S19 | Campaign Engine | BLUME-MCP | Assemble content into campaigns + performance scoreboard + ad budget |
| S20 | Event Bus | Terravian-MCP | pub/sub events (`event_emit/list/subscribe`) — **BUILT** |
| S21 | Job Queue & Daemon | Terravian-MCP | async task queue + handlers (vault/social/festival/affiliate/email) — **BUILT** |
| S22 | Workflow Engine | Terravian-MCP | multi-step orchestration (`workflow_run/list/status`) — **BUILT** |
| S23 | Approval / Human-in-the-Loop | Terravian-MCP | draft→approve gate (`approval_queue/respond`, `human_loop`) — **BUILT** |
| S24 | Listings Pipeline | BLUME-MCP | Festivals + Apartments (ingest→dedup→SEO→publish) — **BUILT (festivals)** |
| S25 | Affiliate / Referral Tracking | shared | affiliate handler (shared w/ Delegatrix) — **PARTIAL** |
| S26 | Social Gateway | Terravian-MCP | multi-platform posting abstraction — **BUILT (Twitter); others phased** |
| S27 | Signals | BLUME-MCP | signal capture/processing — **PARTIAL (scope TBD)** |

---

## ⚠️ RE-BASELINE (2026-06-19) — BLUME is ALREADY BUILT, not greenfield
This ledger was first drafted assuming a blank slate. **Coverage audit (`COVERAGE_REPORT_v1.md`) proved otherwise:** two working MCP servers exist — **`blume/` = BLUME-MCP** (generation, 8 CORE vaults, 26 brands, search, festivals) and **`terravian-mcp/` = Terravian-MCP** (BLUME adapter, social gateway, scheduler+daemon, events, queue, workflows, observability, approvals). The doctrine's BLUME-MCP↔Terravian-MCP split is **real** — and terravian-mcp now consumes BLUME's pure modules through the `@terravian/blume` package boundary (persona/switches/seo/vault deduped; see §5b "Migration").
**So `BLUME-001` (scaffold server) is OBSOLETE.** True Wave-1 order: **BLUME-004 (reconcile) → BLUME-005 (voice cleanup) → S1/S2 artifact+router-tag spine → S4 Lotus (040–043) → BLUME-032 (8→12 vaults).** Lotus + the artifact/router-tag spine are the genuine gaps; most "infra" is built (S20–S27).

**📐 ACTIVE SPECS (build-ready, no further doctrine phase needed):**
- **`build/ARTIFACT_SPINE_SPEC_v1.md`** — S1/S2. Defines Artifact + Router-Tag contract, `thq_artifacts` + `thq_vault_registry`, 8 MCP tools, migration from legacy `VaultEntry`. **Build BEFORE Lotus** (Lotus reads it).
- **`build/LOTUS_ENGINE_SPEC_v1.md`** — S4. C/A/O/P/M scoring → Launch Readiness Index + bands, Health Bar, missing-evidence/bottleneck/Tick Maps, 8 MCP tools. Reads artifacts via the Spine; owns no truth.

**🗄️ STORAGE FACT (corrected from code):** live Supabase tables use the **`thq_` prefix** (`thq_vault_entries`, `thq_op_queue`, `thq_events`, `thq_festivals`) — **not** `blume_*`/`sapi_*`. New spine/Lotus tables follow: `thq_artifacts`, `thq_vault_registry`, `thq_lotus_config`, `thq_readiness_snapshots`. Also: code vault integers (1=published-works…) are **permuted vs doctrine** (1=Brand Assets…) — the registry keys on **slug**, integers are legacy-compat only.

---

## 3. MVP Spine (Wave 1) — the smallest functioning BLUME
**The loop:** one brand → **ingest** artifact → **assign router-tag metadata** → **assign vault/category** → **store** → **Lotus score** → **readiness output**. Nothing else.
**Spine tasks (⭐):** BLUME-001, 002, 003, 010, 011, 020, 021, 030, 031, 040, 041, 042, 043.
**Critical path:** 001 → 002 → 003 → 010 → 011 → 021 → 031 → 041 → 042 → 043 (gated by 020, 030, 040).
**Spine done-criteria:** a single tool call `readiness(brand)` returns a Launch Readiness % + band, computed from artifacts ingested through the tagged/categorized/stored pipeline.

---

## 4. Build Waves
- **Wave 1 — Spine:** the MVP loop above.
- **Wave 2 — Visibility:** vault views, Health Bar, missing-evidence/bottleneck, search, readiness surface, investor summary.
- **Wave 3 — Reliability:** audit log, un-backdatable timestamps, versioning, idempotency, validation, tests, backup.
- **Wave 4 — Intelligence:** recommendation engine, sales switches, memory, library.
- **Wave 5 — Scale:** multi-brand, Terravian-MCP routing + permission, identity, publishing, investor full, performance.
Every task belongs to **exactly one** wave.

---

## 5. Master Task Table
*Legend: ⭐ = MVP spine · Status ∈ {TODO, WIP, DONE, BLOCKED, PARKED}. Later-wave tasks are epic-level — expand into sub-tasks when the wave is reached.*

| ID | Wave | Sys | Task (done-criteria) | Deps | Status |
|----|------|-----|----------------------|------|--------|
| ~~BLUME-001~~ | 1 | S0 | ~~Scaffold BLUME-MCP server~~ — **OBSOLETE: server already runs (`blume/src/mcp/server.ts`)** | — | DONE |
| ⭐ BLUME-004 | 1 | S0 | **Reconcile** the two existing servers against this ledger; mark statuses; document `@terravian/blume` migration | — | **DONE** (see §5b Reconciliation Result) |
| ⭐ BLUME-005 | 1 | S18 | **Doctrine-debt:** retire public `dominion_rex`/`venus_protocol` modes → private-only; set calm-premium house voice (Calm·Premium·Intelligent·Helpful·Strategic) as default | 004 | **DONE** |
| ⭐ BLUME-002 | 1 | S0 | Storage substrate: local JSON primary + Supabase `thq_artifacts` mirror; DDL in `migrations/0001_artifacts.sql` | 001 | **DONE — DDL LIVE** on `wxinipsficonhfifjqek` (thq_artifacts + thq_vault_registry); mirror verified end-to-end |
| ⭐ BLUME-003 | 1 | S0 | Data model: `Artifact{uuid,brand,vault,switch,title,timestamp,version,source,hash,metadata,body,ref,parent_uuid,updated_at}` + `thq_vault_registry` | 002 | **DONE** |
| ⭐ BLUME-010 | 1 | S1 | Artifact ingest tool: accept payload (title, body/ref, brand) → returns uuid | 003 | **DONE** (`artifact_ingest`) |
| ⭐ BLUME-011 | 1 | S1 | Artifact store: persist with hash + timestamp; retrievable by uuid | 010 | **DONE** (`artifact_get`) |
| ⭐ BLUME-020 | 1 | S2 | Router-tag schema validator (the contract) — rejects malformed, accepts valid | 003 | **DONE** (`routertag_validate`) |
| ⭐ BLUME-021 | 1 | S2 | Auto-assign router-tag on ingest (uuid, ts, version, source, hash) | 010,020 | **DONE** |
| ⭐ BLUME-030 | 1 | S3 | Vault category registry — 12 canonical slugs, tiered Core/Extended/Sovereign (matches doctrine) | 003 | **DONE** (`vault_registry`) |
| ⭐ BLUME-031 | 1 | S3 | Assign vault/category to artifact (input or default `creative-drafts`) — artifact.vault ∈ registry | 021,030 | **DONE** |
| ⭐ BLUME-040 | 1 | S4 | Lotus scoring config: Content/Audience/Offer/Proof/Monetization (0–20 each) | 003 | **DONE** (`src/lotus/config.ts`, `lotus_score_config`) |
| ⭐ BLUME-041 | 1 | S4 | Compute per-category score from a brand's artifacts (returns 5 sub-scores) | 031,040 | **DONE** (lineage-deduped) |
| ⭐ BLUME-042 | 1 | S4 | Launch Readiness Index = Σ→% with bands (Go ≥85 / Final-Prep / Structuring / Dev) | 041 | **DONE** |
| ⭐ BLUME-043 | 1 | S4 | `readiness(brand)` tool: returns readiness % + band + sub-scores | 042 | **DONE** (`lotus_readiness`) ★ MILESTONE |
| BLUME-050 | 2 | S3 | Vault-as-view query: "Vault X" = artifacts WHERE brand AND vault=X | 031 | **DONE** (`artifact_list` vault filter) |
| BLUME-051 | 2 | S3 | List vaults for a brand with counts | 050 | TODO |
| BLUME-052 | 2 | S4 | Health Bar data structure (segments + fill %) | 041 | TODO |
| BLUME-053 | 2 | S4 | Missing-evidence detection (empty/thin categories) | 041 | **DONE** (`lotus_missing_evidence`) |
| BLUME-054 | 2 | S4 | Bottleneck detection (lowest-scoring category) | 041 | **DONE** (`lotus_bottleneck`) |
| BLUME-055 | 2 | S4 | Tick Maps (milestone ticks → readiness contribution) | 042 | TODO |
| BLUME-060 | 2 | S11 | Artifact search by brand/vault/switch/text | 031 | WIP (brand/vault/switch DONE via `artifact_list`; text search TODO) |
| BLUME-061 | 2 | S11 | Readiness/vault summary query API | 043,050 | TODO |
| BLUME-062 | 2 | S16 | Structured logging of ingest/score events | 011 | TODO |
| BLUME-063 | 2 | S16 | Readiness/vault status surface (tool/CLI output) | 061 | TODO |
| BLUME-064 | 2 | S10 | Investor-facing readiness summary (sanitized) | 043 | TODO |
| BLUME-070 | 3 | S12 | Append-only proof-of-commerce audit log (hashed chain, immutable) | 011 | TODO |
| BLUME-071 | 3 | S12 | Un-backdatable timestamp enforcement | 070 | TODO |
| BLUME-072 | 3 | S12 | Artifact versioning (immutable originals; v1,v2…) | 011 | **DONE** (`versionArtifact`, parent lineage) |
| BLUME-073 | 3 | S1 | Idempotent ingest (dedupe by hash) | 021 | TODO |
| BLUME-074 | 3 | S2 | Input validation + error contracts across tools | 020 | TODO |
| BLUME-075 | 3 | S0 | Test suite: spine loop end-to-end | 043 | TODO |
| BLUME-076 | 3 | S4 | Test suite: scoring correctness | 042 | TODO |
| BLUME-077 | 3 | S0 | Backup/restore of artifact store | 003 | TODO |
| BLUME-080 | 4 | S5 | Recommendation engine: "what next" from readiness + bottleneck + missing-evidence | 053,054 | **DONE** (`recommend_next`) |
| BLUME-081 | 4 | S5 | Next-best-action per Sales Switch | 080,090 | **DONE** (category→switch + rationale) |
| BLUME-082 | 4 | S5 | Recommendations use compounded Memory learnings | 080,101 | TODO (blocked on Memory vault S8) |
| BLUME-090 | 4 | S6 | Sales Switch model (7 switches) + switch→vault mapping | 030 | TODO |
| BLUME-091 | 4 | S6 | Switch progression tracking per brand | 090,041 | TODO |
| BLUME-092 | 4 | S6 | LUME(Switch 1)/BLUME(2–7) split handling | 090 | TODO |
| BLUME-100 | 4 | S8 | Memory vault ingest (ADRs, decisions, learnings, journals) | 031 | TODO |
| BLUME-101 | 4 | S8 | Cross-brand learnings surface | 100 | TODO |
| BLUME-110 | 4 | S9 | Library of Toravian — sovereign, trustee-only access control | 031,140 | TODO |
| BLUME-120 | 5 | S7 | Brand registry: owner→holding→brand hierarchy | 003 | TODO |
| BLUME-121 | 5 | S7 | Multi-brand artifact scoping | 120,031 | TODO |
| BLUME-122 | 5 | S7 | Per-brand vault instantiation (logical, default) | 121,050 | TODO |
| BLUME-130 | 5 | S15 | Terravian-MCP scaffold (separate MCP server) | 120 | TODO |
| BLUME-131 | 5 | S15 | Cross-brand routing: where artifacts/Lotus-outputs go | 130,021 | TODO |
| BLUME-132 | 5 | S15 | Ownership/permission model: SlateRiver root → future TFT/TDT | 130,120 | TODO |
| BLUME-133 | 5 | S15 | Forward-compatible re-parenting (entity tree) | 132 | TODO |
| BLUME-134 | 5 | S15 | Route Lotus outputs via Terravian-MCP | 131,043 | TODO |
| BLUME-140 | 5 | S14 | Identity/auth integration (Noo World login; trustee role for Sovereign) | 130 | TODO |
| BLUME-150 | 5 | S13 | Publishing engine: StealthAPI/social publish → generates Proof-of-Use artifacts (NB: needs StealthAPI repoint to `sapi_*`) | 131 | TODO |
| BLUME-151 | 5 | S13 | Publish → auto-ingest proof artifact loop | 150,010 | TODO |
| BLUME-160 | 5 | S10 | Investor Vault artifacts (pitch, deal flow) | 031 | TODO |
| BLUME-161 | 5 | S10 | Investor readiness deck generation | 064,160 | TODO |
| BLUME-170 | 5 | S4 | Performance: batch scoring across many brands | 041,121 | TODO |
| BLUME-171 | 5 | S4 | Caching/recompute strategy for readiness | 042 | TODO |
| BLUME-180 | 5 | S3 | Compliance vault (PARKED pending Sep–Dec 2026 review; may fold → Operations/Systems) | 031 | PARKED |
| BLUME-200 | 4 | S17 | Content generation core: produce content artifact (post/email/page/ad copy) for brand+switch → ingests as artifact | 090,021 | **DONE** (`ingestGenerated`) |
| BLUME-201 | 4 | S17 | Channel formats: social post · email · landing copy · ad copy | 200 | WIP (post/AIDA/offer/email/SEO done; ad/landing copy TODO) |
| BLUME-202 | 4 | S17 | Generated content → Creative Drafts vault; on publish → Published Works/Proof-of-Use | 201,031 | **DONE** (drafts→Creative Drafts, approved→Published Works; Proof-of-Use deferred to terravian-mcp posting) |
| BLUME-210 | 4 | S18 | Voice/Persona library + schema (house voices + style archetypes — see ARCHITECTURE "Voices" note) | 200 | TODO |
| BLUME-211 | 4 | S18 | Tone selection: apply chosen voice to content generation | 210,200 | TODO |
| BLUME-212 | 4 | S18 | A/B/n voice testing: generate variants in N voices, tag for comparison | 211 | TODO |
| BLUME-213 | 4 | S18 | Voice performance → which voice converts (Copywriting Campaign Tracker) → feeds Lotus/Sales Health | 212,041 | TODO |
| BLUME-214 | 4 | S18 | BLUME house voice (elegant/clever/confident; calm-premium — NO public "Mystic-Tech") as default | 210 | TODO |
| BLUME-220 | 4 | S19 | Campaign model: group content across channels, tied to switches | 201,090 | TODO |
| BLUME-221 | 4 | S19 | Campaign performance tracker (scoreboard: impressions/clicks/conv/revenue by voice & channel) | 220,041 | TODO |
| BLUME-222 | 5 | S19 | Ad budget tracker (micro-budget $5–$50 tests) | 220 | TODO |
| BLUME-223 | 5 | S19 | Email sequence builder | 201 | TODO |
| BLUME-224 | 5 | S19 | Landing page generation | 201 | TODO |
| BLUME-152 | 5 | S13 | Social scheduling + posting | 150,201 | **DONE** (terravian-mcp scheduler+daemon) |
| BLUME-153 | 5 | S13 | Multi-channel distribution (social + email) | 152,223 | WIP (social done; email handler exists) |
| BLUME-032 | 1 | S3 | **Vault enum migration 8→12**: add 9 R&D, 11 Memory, 12 Library (Sovereign); 10 Compliance PARKED. CORE 1–8 already match. | 030 | TODO |
| BLUME-230 | — | S20 | Event Bus — adopt `terravian-mcp/src/events` | — | **DONE/ADOPT** |
| BLUME-231 | — | S21 | Job Queue & Daemon — adopt `terravian-mcp/src/queue` + handlers | — | **DONE/ADOPT** |
| BLUME-232 | — | S22 | Workflow Engine — adopt `terravian-mcp/src/workflows` | — | **DONE/ADOPT** |
| BLUME-233 | — | S23 | Approval / Human-in-the-Loop — adopt `approval_queue/respond` + `human_loop` | — | **DONE/ADOPT** |
| BLUME-234 | — | S24 | Listings Pipeline — adopt Festivals (+Apartments scaffold) | — | **DONE/ADOPT** (festivals) |
| BLUME-235 | 5 | S25 | Affiliate / Referral Tracking — `queue/handlers/affiliate.ts` (shared w/ Delegatrix) | 231 | PARTIAL |
| BLUME-236 | — | S26 | Social Gateway — multi-platform abstraction | — | **DONE/ADOPT** (Twitter live; others phased) |
| BLUME-237 | — | S27 | Signals — `blume/src/signals` (define scope) | — | PARTIAL |

> **As-built status overlay (from `COVERAGE_REPORT_v1.md`):** also already BUILT (mark on next pass): S0 scaffold · S6 switch model (BLUME-090) · S7 flat brand registry (BLUME-120 partial — needs owner→holding hierarchy) · S11 search (vault-based, not artifact) · S16 logging/health (BLUME-062/063) · S17 generation (BLUME-200/201). **Genuinely MISSING keystones:** ★ **S4 Lotus Engine (040–043)** · **S1/S2 Artifact+Router-Tag spine** · S5 Recommendation · S8 Memory / S9 Library vaults.

---

## 5b. BLUME-004 — Reconciliation Result (verified by code, 2026-06-19)
*Authoritative system-level status. Verdicts: **BUILT · PARTIAL · MISSING · OBSOLETE.** Verified via `blume/src/mcp/server.ts`, `terravian-mcp/src/server.ts` tool surface, repo globs, and grep (no `lotus|readiness|score`; no artifact/router-tag contract).*

| Sys | Verdict | Evidence / what's there vs. missing |
|-----|---------|-------------------------------------|
| S0 Foundation | **BUILT** | Both MCP servers run (`blume/src/mcp/server.ts`, `terravian-mcp/src/server.ts`). |
| S1 Artifact Engine | **BUILT** | `src/artifacts/store.ts` — `artifact_ingest/list/get/version`; uuid + immutable timestamp + version + sha256 hash. **`listArtifacts` is Supabase-first (reads live `thq_artifacts`) with local fallback;** writes still local + live mirror. |
| S2 Router-Tag Engine | **BUILT** | `src/artifacts/routerTag.ts` — full contract + `routertag_validate`; auto-assigned on ingest. |
| S3 Vault Engine | **PARTIAL** | Legacy 8-vault store still serves `blume_*vault` tools. NEW canonical **12-slug `thq_vault_registry`** built (artifacts key on slug, integers legacy-compat). Migrating the *vault-entry tools* to 12 = BLUME-032. |
| S4 Lotus Engine | **BUILT (readiness + guidance)** | ★ `src/lotus/` — `lotus_readiness` (C/A/O/P/M + Index + band) + **`lotus_bottleneck` + `lotus_missing_evidence`** (Wave-2 depth: score→guidance). **MILESTONE: FIRST LOTUS SCORE achieved.** Still deferred: Health Bar / Tick Maps / investor summary. |
| S5 Recommendation | **BUILT** | `src/recommend/` — `recommend_next` composes Lotus (readiness+bottleneck+missing-evidence) + 7 Sales Switches → prioritized, switch-aware action plan + headline + primary action. (Memory-compounded recs BLUME-082 still blocked on S8.) |
| S6 Sales Switch | **PARTIAL** | `content/switches.ts` + `blume_diagnose_switch` built. Switch→vault map + LUME/BLUME split not formalized. |
| S7 Brand Engine | **PARTIAL** | Flat 26-brand registry + add/remove. No owner→holding hierarchy. |
| S8 Memory (V11) | **MISSING** | Sovereign vault absent (only 8 vaults). |
| S9 Library (V12) | **MISSING** | Sovereign vault absent. |
| S10 Investor (V8) | **PARTIAL** | Vault 8 stores entries; no readiness/deck generation (needs Lotus). |
| S11 Search | **BUILT** | `vault_search` (vault-based, not artifact-based). |
| S12 Audit | **PARTIAL** | Vault append/logging only; no hash chain / immutability / versioning. |
| S13 Publishing & Distribution | **BUILT** | Social gateway, `blume_tweet`/`blume_post`, scheduler + auto-fire daemon, bulk schedule. |
| S14 Identity | **MISSING/STUB** | `nooworld-login` brand JSON only; no MCP auth / trustee roles. |
| S15 Terravian-MCP Routing | **PARTIAL** | Routing *mechanics* (queue/events/workflows) built; **ownership/permission model (SlateRiver→TFT/TDT) MISSING.** |
| S16 Observability | **BUILT** | `system_health`, `failure_feed`, `analytics_summary`. |
| S17 Content & Copywriting | **BUILT + LIVE** | post / AIDA / offer / email / SEO. **Now auto-ingests artifacts** (`src/content/ingestGenerated.ts`) → drafts to Creative Drafts, approved posts to Published Works → **Lotus updates live**. |
| S18 Voice / Persona | **PARTIAL** | Per-brand voice built. ✅ Doctrine-debt RESOLVED (BLUME-005): `dominion_rex`/`venus_protocol` now private; public default = calm-premium. Still no voice library / A-B (Wave 4). |
| S19 Campaign | **PARTIAL** | AIDA sequence only; no campaign model / scoreboard / ad-budget. |
| S20 Event Bus | **BUILT** | `event_emit/list/subscribe` (`terravian-mcp/src/events`). |
| S21 Job Queue & Daemon | **BUILT** | `op_task_*`, `queue_list`, handlers (vault/social/festival/affiliate/email). |
| S22 Workflow Engine | **BUILT** | `workflow_run/list/status`. |
| S23 Approval / HITL | **BUILT** | `approval_queue/respond` + `human_loop` flag on generation. |
| S24 Listings | **PARTIAL** | Festivals pipeline BUILT (`festival_sync/list`); **apartments = types only.** |
| S25 Affiliate | **PARTIAL** | `queue/handlers/affiliate.ts` exists; not wired to a product flow. |
| S26 Social Gateway | **BUILT** | Multi-platform abstraction; **Twitter live, others phased/stub.** |
| S27 Signals | **PARTIAL** | `blume/src/signals` types+index only; scope undefined. |

**OBSOLETE:** `BLUME-001` (scaffold server) — both servers already run.
**Migration (2026-06-20 — substantially done):** `terravian-mcp` now consumes BLUME through the **`@terravian/blume` package boundary** for the pure modules — **`agents/blume/persona.ts`, `switches.ts`, `seo.ts`, `vault.ts` are re-export shims** (logic deduped to the package; ~627 duplicated lines → ~55). Declared `@terravian/blume: file:../blume` in `terravian-mcp/package.json`; resolves via the `node_modules/@terravian/blume → blume` symlink consuming `blume/dist`. **Remaining local by design (not practical without behavior change):** `agents/blume/index.ts` generation orchestration (terravian-mcp's own `think` + brand store + gateway/tweet posting), `memory/brands.ts`, `cli.ts`. Verified: tsc clean both repos + 8/8 runtime boundary check (`terravian-mcp/scripts/extract-smoke.ts`).
**Net (updated):** **Both keystones BUILT** — S1/S2 Artifact Spine (§5c) and **S4 Lotus readiness (§5d)**. **MILESTONE: FIRST LOTUS SCORE achieved — BLUME has crossed from storage system to intelligence system.** Remaining is Wave-2 depth (Lotus polish, recommendations) + cleanups (8→12 vault-tool migration).

---

## 5c. Artifact / Router-Tag Spine — Build Result (2026-06-19)
**Module:** `blume/src/artifacts/` — `types.ts` · `registry.ts` · `routerTag.ts` · `store.ts` · `migrate.ts`. DDL: `migrations/0001_artifacts.sql`. Tools wired in `src/mcp/server.ts`.
**Contract shipped:** `{uuid, brand, vault(slug), switch, title, timestamp, version, source, hash, metadata}` (+ artifact payload `body/ref/parent_uuid/updated_at`).
**MCP tools:** `artifact_ingest` · `artifact_list` · `artifact_get` · `routertag_validate` · `vault_registry` · `artifact_migrate_legacy`.
**Storage:** local JSON primary (`./vaults/_artifacts/<brand>/<uuid>.json`) + `thq_artifacts` Supabase mirror; canonical `thq_vault_registry` (12 slugs, integers legacy-compat).
**Verified:** `tsc --noEmit` clean + 18/18 runtime assertions (`scripts/spine-smoke.ts`): uuid/timestamp/version/hash assignment, vault & switch filters, uuid round-trip, immutable versioning, malformed-tag rejection, 12-vault registry.
**Legacy safety:** vault system untouched; `artifact_migrate_legacy` is **dry-run by default** (no full migration performed). No breaking changes.
**Lotus-ready:** `artifact_list(brand, vault?, switch?)` returns exactly what `lotus_readiness(brand)` needs (spec §8 hand-off test satisfied).

---

## 5d. Lotus Engine — Build Result (2026-06-20) · ★ MILESTONE: FIRST LOTUS SCORE
**Module:** `blume/src/lotus/` — `types.ts` · `config.ts` (rubric v1) · `engine.ts`. Tools in `src/mcp/server.ts`.
**Shipped:** `lotus_readiness(brand)` → `{ percent, band, subScores{content,audience,offer,proof,monetization}, artifactCount, generatedAt }` · `lotus_score_config`.
**Scoring:** each category 0–20 = `min(20, distinctQualifyingArtifacts × 5)`; qualification by vault slug and/or Sales Switch (spec §3 mapping). Index = Σ = 0–100. Bands: Go ≥85 / Final-Prep 70–84 / Structuring 50–69 / Dev <50. **Stateless/derived** — reads via `listArtifacts`, owns no truth. Versions deduped by lineage (no inflation).
**Verified:** `tsc --noEmit` clean + 13/13 runtime assertions (`scripts/lotus-smoke.ts`): graceful-empty (0%/Dev), a seeded brand scoring exactly 90/Go, per-category correctness, version-dedup, band thresholds.
**Wave-2 depth added (2026-06-20):** `lotus_bottleneck` (lowest category + gap-to-next-band) + `lotus_missing_evidence` (empty=critical / thin categories + suggested artifact). Pure/derived (reuse `computeReadiness`). Verified: tsc clean + 11/11 (`scripts/lotus-depth-smoke.ts`).
**Still deferred (NOT built):** Health Bar, Tick Maps, investor summary, readiness snapshots, recommendation engine (S5).
**Crossing:** a brand can now enter the system and receive C/A/O/P/M + Launch Readiness Index — **and now guidance on what to fix next.** BLUME is an intelligence system.

---

## 5e. Generators → Artifacts (Lotus runs LIVE) — Build Result (2026-06-20)
**Module:** `blume/src/content/ingestGenerated.ts`; wired into `generator.ts` (`generatePost`/`generateOffer`/`generateEmail`; AIDA inherits via `generatePost`) + `seo.ts` (`generateSEOContent`).
**Behavior:** every generation auto-creates an artifact — **drafts → Creative Drafts** (`source: blume-generated`), **approved posts (`humanLoop=false`) → Published Works** (`source: published`). Switch tagged by intent (post→goal, offer→5, email→5/4, SEO→3). **Best-effort: ingest failure never breaks generation; output formats unchanged.**
**Verified (live LLM):** `scripts/generate-live-smoke.ts` 6/6 — real `generatePost(mrmetaphysical)` → artifact created (Creative Drafts, hash+uuid) → `lotus_readiness` moved **0% → 5%** with no manual ingest. tsc clean.
**Deferred:** Proof-of-Use on real external posts lives in terravian-mcp's posting path (needs the `@terravian/blume` package extraction to share the spine); ad/landing-copy generators not built (BLUME-201 WIP).

---

## 5g. Live migration + Acceptance Test (2026-06-20) — intelligence loop proven on LIVE data
**DDL applied to live Supabase `wxinipsficonhfifjqek`** (project "revenue-core") via the linked CLI:
`supabase db query --linked --file migrations/0001_artifacts.sql`. Created `thq_artifacts` + `thq_vault_registry`.
Integrity verified: registry = 12 rows (8 core / 2 extended / 2 sovereign), `thq_artifacts` present + empty, legacy-int map correct.
*(Applied via the CLI's own legitimate auth; the project is linked but the link scaffold `supabase/` is gitignored — canonical migration stays in `migrations/`.)*

**`scripts/acceptance.ts` — the single BLUME Acceptance Test.** Runs the full loop with the live DB in it:
`artifact_create → store → read (local + live `thq_artifacts`) → lotus_readiness → lotus_bottleneck → lotus_missing_evidence → recommend_next`, asserts each stage, **self-cleans** its test brand from live, and prints **PASS/FAIL**.
Run: `VAULT_ROOT=./.acceptance npx tsx scripts/acceptance.ts` (Supabase enabled from `.env`).
**Result: PASS ✅ 13/13** — live writes land in `thq_artifacts`, live reads round-trip (uuid+hash), readiness 25%/Dev with correct C/A/O/P/M, bottleneck `audience/0`, missing-evidence 1 critical + 3 thin, `recommend_next` primary = audience. Zero residual data left in live.

---

## 5h. Live-read reliability fix (2026-06-20) — engine reads live, not just local
**Gap closed:** Supabase was a write-mirror only; the engine read the local JSON store. Now **`listArtifacts` is Supabase-first with local fallback** — the read boundary Lotus/Recommendation depend on.
**Boundary (unchanged contract):** `Lotus / Recommendation → listArtifacts → Artifact Store → Supabase-first read → local fallback`. **Lotus never queries Supabase directly.**
**Implementation:** `dbReadArtifacts` (returns `null` on error → triggers local fallback; `[]` = legitimately empty); `store.listArtifacts` is now `async` (Supabase-first via `dbReadArtifacts`, else `listArtifactsLocal`); `computeReadiness` / `detectBottleneck` / `detectMissingEvidence` / `recommend` and the MCP handlers are now `async` (await the read). `versionArtifact` + `getArtifact` stay sync-local (fallback + local round-trip). **No change to Lotus scoring or Recommendation logic, doctrine, or taxonomy.**
**Acceptance proof (`scripts/acceptance.ts`, two modes):**
- **LIVE 10/10 — "PASS — Supabase read path used":** writes mirror to live; **local store is WIPED**; engine still returns 25%/Dev + audience bottleneck + recommend → it read from live `thq_artifacts`. Self-cleans.
- **OFFLINE 8/8 — "PASS — local fallback path used":** Supabase disabled → reads local.
- Plus 4 supplementary smokes pass offline (spine 18 / lotus 13 / depth 11 / recommend 13).
**Success criterion met:** a fresh process reads from live `thq_artifacts` and produces identical readiness/recommendation **without the local JSON store**.

---

## 6. Dependency Notes & Critical Path
- **Critical path to first value (Wave 1):** `001 → 002 → 003 → {010→011, 020→021}, {030}, {040} → 031 → 041 → 042 → 043`.
- **Wave 2** depends on `031` (categorization) and `041/043` (scores) existing.
- **Wave 4 Recommendation (080)** is the first "BLUME answers what next" — depends on Wave 2 detection (053,054).
- **Wave 5 Terravian-MCP (130+)** is the *only* place ownership/permission lives — never bleed it into BLUME-MCP.
- **External dependency:** Publishing (150) is gated on the StealthAPI `.from()` repoint to `sapi_*` (see memory `project_terravian_publishing_pipeline`).

---

## 7. Continuity Protocol
**Task lifecycle:** `TODO → WIP → DONE` (or `BLOCKED`/`PARKED`). One task = one focused session.
**On completion, ALWAYS:**
1. Set the task row Status → `DONE` here.
2. Append a line to `build/COMPLETED.md`: `BLUME-### · <date> · <commit-sha> · <one-line result>`.
3. Update `build/CURRENT_STATE.md` (last-done, in-progress, blocked) and `build/NEXT_ACTION.md` (the next single task).
4. If a decision was made, append an ADR to `build/DECISIONS.md`.

**Standard handoff block** (paste into CURRENT_STATE.md and/or session end):
```
## HANDOFF — <date>
Current State : Wave <n>, working BLUME-<id>
Completed     : up to BLUME-<id> (see COMPLETED.md)
Blocked       : <BLUME-id + reason, or none>
Next Task     : BLUME-<id> — <one line>
Known Risks   : <bullets, or none>
```

**Success criterion:** a future Claude session, after months away, reads CURRENT_STATE → NEXT_ACTION → does the next task — with near-zero context loss.

---

## 8. Persistence Files (always exist, in `build/`)
| File | Purpose | Cadence |
|------|---------|---------|
| `BUILD_LEDGER.md` | This file — canonical roadmap, all tasks, waves, deps | Update task status as work lands |
| `CURRENT_STATE.md` | Living snapshot: wave, last-done, WIP, blocked | Every session |
| `NEXT_ACTION.md` | The single next task to execute | Every session |
| `ARCHITECTURE.md` | Locked invariants (constitutional layer, taxonomy, MCP boundary, stack, open Qs) | Rarely (on architecture change) |
| `DECISIONS.md` | ADR log — append-only design decisions (ADR-000 = doctrine lock) | On each decision |
| `COMPLETED.md` | Append-only done log (id · date · commit · result) | On each task done |
