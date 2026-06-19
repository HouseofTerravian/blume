# BLUME Coverage Report v1
**Date:** 2026-06-19 · **Mode:** Dual-Core (Claude audit → Noo1 advisory → Terravian decides)
**Trigger:** Final coverage audit before merging doctrine PR #1.
**Success criterion:** *A future builder should not discover a major BLUME subsystem six weeks from now and ask "why wasn't this in the ledger?"*

> ## ⚠️ HEADLINE FINDING — the ledger assumed greenfield; BLUME is already built
> BLUME is **not** a blank slate. Two working MCP servers already exist, and the doctrine's BLUME-MCP↔Terravian-MCP split is **already realized in code and mid-migration**:
> - **`C:\dev\active\blume` = BLUME-MCP** (standalone). `src/mcp/server.ts` exposes generation (posts, AIDA sequences, offers, emails, switch-diagnosis, site analysis, SEO), the **8 CORE vaults** (1–8), a 26-brand registry (the 26 JSONs), vault search, and a **festivals/listings pipeline**.
> - **`C:\dev\active\terravian-mcp` = Terravian-MCP** (orchestration). Embedded BLUME agent **+ a `blume` adapter** (`adapters/blume.ts`, a "baby bridge" importing `@terravian/blume`), a multi-platform **social gateway**, scheduler + auto-fire **daemon**, **event bus**, **job queue + handlers** (vault/social/festival/affiliate/email), **workflow engine**, **observability** (system health, failure feed, analytics), and an **approval/human-in-the-loop queue**.
>
> **Consequence:** `BLUME-001 = "scaffold the BLUME-MCP server"` is obsolete (the server runs). The ledger must be **re-baselined against the as-built reality** before any Wave-1 work. The good news: the as-built architecture **validates the doctrine** — the two-repo split is real.

---

## 1. Capabilities ALREADY REPRESENTED (in ledger *and* built in code)
*These exist in the running servers and the ledger already names them. Status = BUILT — mark DONE/ADOPT, do not rebuild.*

| Ledger Sys | Capability | Where it lives (built) | Live tools |
|---|---|---|---|
| S0 Foundation | MCP scaffold + transport + tool registration | both servers | (both run) |
| S3 Vault Engine (CORE) | **8 CORE vaults 1–8** — Brand Assets · Published Works · Proof-of-Use · Commerce Evidence · Creative Drafts · Internal Notes · Legal · Investor | `blume/src/vault` | `blume_init_vaults`, `blume_vault_summary`, `blume_read_vault`, `blume_log_to_vault` |
| S6 Sales Switch Engine | 7 Sales Switches + switch diagnosis | `blume/src/content/switches.ts` | `blume_diagnose_switch` |
| S7 Brand Engine | Brand registry (flat) + **26 brands** + add/remove | `blume/src/brands/registry.ts` | `blume_list_brands`, `blume_add_brand`, `blume_remove_brand` |
| S11 Search Engine | Full-text vault search | `blume/src/vault` | `vault_search` |
| S13 Publishing & Distribution | Multi-platform posting + scheduler + auto-fire daemon + bulk schedule | `terravian-mcp/src/tools/social`, `tools/scheduler` | `blume_post`, `blume_tweet`, `blume_schedule_post`, `blume_bulk_schedule`, `blume_cancel_post`, `blume_list_scheduled` |
| S16 Observability | System health, failure feed, analytics | `terravian-mcp/src/observability` | `system_health`, `failure_feed`, `analytics_summary` |
| S17 Content & Copywriting | Post / AIDA / offer / email / SEO generation + site analysis | `blume/src/content/*` | `blume_generate_post`, `blume_aida_sequence`, `blume_generate_offer`, `blume_generate_email`, `seo_generate`, `blume_analyze_site` |

---

## 2. Capabilities PARTIALLY REPRESENTED (named but not fully built, or built but not doctrine-aligned)

| Ledger Sys | Status | Gap |
|---|---|---|
| **S3 Vault Engine (full taxonomy)** | 8 of 12 built | CORE 1–8 exist. **Missing: 9 R&D, 11 Memory, 12 Library** (Sovereign); 10 Compliance parked. Vault tools hard-cap at `vault 1–8`. → **8→12 migration needed.** |
| **S18 Voice / Persona** | partial + **doctrine-debt** | Per-brand voice (archetype/tone/personality/do/dont/sample_phrases) is built. **But `generate_post`/`aida_sequence` expose `mode ∈ {collaborative, dominion_rex, venus_protocol, commerce, insight, grace}` — `dominion_rex` (warfare "Dominion Rex") and `venus_protocol` are RETIRED-doctrine modes still public in the tool schema.** No selectable house-voice/style-archetype library yet; no A/B voice testing. |
| **S19 Campaign Engine** | thin | AIDA 4-post sequence exists. **Missing: campaign model (group content across channels/switches), performance scoreboard, ad-budget tracker, email-sequence builder, landing-page generation.** |
| **S10 Investor Engine** | vault only | Vault 8 (Investor) stores entries. **Missing: investor-readiness summary/deck generation** (depends on Lotus, which is absent). |
| **S12 Audit Engine** | logging only | Vaults append entries. **Missing: hashed immutable proof-chain, un-backdatable timestamp enforcement, artifact versioning.** |
| **S14 Identity** | brand stub | `nooworld-login` brand JSON exists. **Missing: auth integration + trustee role for Sovereign vaults.** |
| **S15 Terravian-MCP routing** | infra only | Queue/events/workflows give routing *mechanics*. **Missing: the ownership/permission model (SlateRiver root → future TFT/TDT) — the doctrine's whole point of this layer.** |

---

## 3. Capabilities MISSING (not built, and several not even named in the ledger)

### 3a. Missing keystones (named in ledger, genuinely absent)
- **★ S4 — LOTUS ENGINE (the single biggest gap).** The doctrine keystone — *"how healthy / what's the launch readiness"* — **is not built anywhere.** No Launch Readiness Index, no Health Bar, no Tick Maps, no C/A/O/P/M scoring, no missing-evidence/bottleneck detection. `analytics_summary` is ops telemetry, **not** Lotus. **This is the highest-value build target.**
- **S1/S2 — Artifact + Router-Tag spine.** The unifying `artifact{uuid,brand,vault,switch,title,ts,version,source,hash,metadata}` model + router-tag validator/auto-assign **is not implemented.** Vaults store ad-hoc entries; there is no canonical artifact contract — the doctrine's atomic unit. **The MVP spine does not yet exist.**
- **S5 — Recommendation Engine** ("what next" from readiness/bottleneck) — absent (only `diagnose_switch` gives point advice).
- **S8 Memory / S9 Library** (Vaults 11/12) — absent (only 8 vaults exist).

### 3b. Built subsystems the ledger NEVER NAMED (coverage holes — add them)
*These run in `terravian-mcp` / `blume` but appear nowhere in the 20-system catalog. This is precisely the "why wasn't this in the ledger?" risk.*
- **Event Bus** — `event_emit/list/subscribe/unsubscribe/subscriptions_list` (`terravian-mcp/src/events`).
- **Job Queue + Daemon + Handlers** — `op_task_*`, `queue_list`, `task_retry/status`; handlers for vault/social/festival/affiliate/email (`terravian-mcp/src/queue`).
- **Workflow Engine** — `workflow_run/list/status` (`terravian-mcp/src/workflows`).
- **Approval / Human-in-the-Loop** — `approval_queue/respond` + the `human_loop` flag on generation (`terravian-mcp`). BLUME's "draft → approve → publish" gate.
- **Affiliate / Referral Tracking** — `queue/handlers/affiliate.ts` (ties directly to Delegatrix's affiliate model).
- **Listings Pipeline (Festivals + Apartments)** — `festival_sync/list`, `blume/src/listings/{festivals,apartments}` (FestivalCalendar.online: ingest→dedup→SEO→publish). A whole revenue vertical.
- **Signals** — `blume/src/signals` (signal capture/processing).
- **Social Gateway** — multi-platform abstraction (`terravian-mcp/src/tools/social/gateway.ts`).

### 3c. Adjacent products / systems found in archives (decide scope — likely NOT this ledger)
- **DELEGATRIX™ / WTH! Dispatch™** (Delegatrix Business Plan, 04.16.26). A standalone **AI-first delegation router** (four paths: AI-first / build-the-tool / human-routing / personal), incubated in WTH!, with its own marketplace, **affiliate/referral engine**, routing-quality-score KPI, and Explorer/Operator/Command pricing. **This is a separate product, not a BLUME subsystem** — but it shares infra (the affiliate handler) and BLUME contributes its brand/voice/copy. → **Recommend a separate `delegatrix/build/` ledger;** record BLUME's role as copy/voice/brand only. `launchpad18` brand JSON may be related.
- **The Terravian AI Council** (3.3.26 — Noo1, STRATOS, BLUME, OMNIX, PACTUM, VERITAS, LEX-ONE, SCRIVA, REXIS, + external PQ). A **multi-agent advisory council** — the operational, de-mysticized successor to the retired "Pantheon." It is **bigger than BLUME** (BLUME is one council member). → **Not BLUME-owned;** belongs to a Terravian-MCP-level multi-agent orchestration decision. Flag for Chude: is the AI Council a system to build, or an authoring convention? *(Source PDF was 600+ pages and could not be machine-read this pass — flagged for a dedicated review.)*

---

## 4. Capabilities INTENTIONALLY RETIRED (do not rebuild; clean up residue)
*From doctrine v1 + Q-1/Q-2/Q-3 resolution — confirmed retired:*
- **Public-facing mysticism** (soul / Pantheon / Law-of-One / esoteric framing) → private Library of Toravian only.
- **Warfare / empire language** (destroy/suppress rivals, First Strike, **Dominion Rex**) → retired.
- **Founder pattern-hoarding** (winning by weakening the SaaS) → retired.
- **Competitor Vault + Rival Dashboard** ("Thorne's Rival Dashboard") → retired; competitive *awareness* (benign) folds into R&D (Vault 9).
- **Esoteric vault** → merged into Library (Vault 12).

**⚠️ Retired-but-still-in-code (doctrine-debt to fix):** the generation tools still expose **`mode: "dominion_rex"`** and **`mode: "venus_protocol"`** publicly. Per Terravian's 6.19.26 ruling, the public default voice = **Calm · Premium · Intelligent · Helpful · Strategic**, and Mystic-Tech / warfare modes are **private/optional/House-of-Terravian only**. → cleanup task added (BLUME-005).

---

## 5. RECOMMENDED NEW / CHANGED LEDGER TASKS
*Added to `BUILD_LEDGER.md`. New systems S20–S27 formalize the already-built infra so it's tracked, not rediscovered.*

**Re-baseline (do first):**
- **BLUME-004** — Inventory & reconcile the two existing servers against the ledger; set BUILT systems to DONE/ADOPT. *(Replaces obsolete "scaffold" framing of BLUME-001.)*
- **BLUME-005** — Doctrine-debt: retire public `dominion_rex`/`venus_protocol` modes → private-only; set calm-premium house voice as default (ties BLUME-214).
- **BLUME-032** — Vault enum migration **8→12**: add 9 R&D, 11 Memory, 12 Library (Sovereign); 10 Compliance stays PARKED. CORE 1–8 already match.

**Formalize built-but-unnamed subsystems (new systems S20–S27):**
- **BLUME-230 / S20 Event Bus** — adopt `terravian-mcp/src/events` (status: BUILT).
- **BLUME-231 / S21 Job Queue & Daemon** — adopt `terravian-mcp/src/queue` + handlers (BUILT).
- **BLUME-232 / S22 Workflow Engine** — adopt `terravian-mcp/src/workflows` (BUILT).
- **BLUME-233 / S23 Approval / Human-in-the-Loop** — adopt `approval_queue/respond` + `human_loop` (BUILT).
- **BLUME-234 / S24 Listings Pipeline** — adopt Festivals + Apartments (`festival_sync/list`) (BUILT, festivals).
- **BLUME-235 / S25 Affiliate / Referral Tracking** — `queue/handlers/affiliate.ts` (PARTIAL; shared w/ Delegatrix).
- **BLUME-236 / S26 Social Gateway** — multi-platform abstraction (BUILT, Twitter live; others phased).
- **BLUME-237 / S27 Signals** — `blume/src/signals` (PARTIAL — define scope).

**Scope decisions to flag (not BLUME tasks):**
- Delegatrix → its own ledger. AI Council → Terravian-MCP multi-agent decision + dedicated archive review.

---

## Merge recommendation
**Merge PR #1.** The doctrine is not only sound — the **as-built two-repo reality confirms it** (BLUME-MCP vs Terravian-MCP is real and mid-migration; CORE 8 vaults already match; switches/generation/publishing exist). The audit found **no doctrine defect.**

What it found instead is a **ledger accuracy** problem (greenfield assumption) — now corrected in the same branch by: this report, the S20–S27 additions, the re-baseline tasks (BLUME-004/005/032), and updated `CURRENT_STATE`/`NEXT_ACTION`. With those in, PR #1 ships an **accurate** ledger.

**After merge, the true Wave-1 sequence is:** BLUME-004 (reconcile) → **BLUME-005 (voice cleanup)** → **S4 Lotus Engine (040–043) — the real missing keystone** → S1/S2 artifact+router-tag spine → BLUME-032 (8→12 vaults). Not "scaffold a server."
