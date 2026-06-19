# BLUME — DECISIONS (ADR log)
*Append-only. One entry per architectural decision. Newest at bottom.*

---
## ADR-000 — Doctrine Lock (Q-1/Q-2/Q-3)
**Date:** 2026-06-19 · **Status:** Accepted (Terravian final; Noo1 advised)
**Decision:** BLUME doctrine locked — Constitutional Layer, Structural Principle (vaults subordinate to brands),
12-vault taxonomy (Core/Extended/Sovereign; Esoteric→Library; Competitor/Rival retired), reality-first ownership
(SlateRiver root → future TFT/TDT), Lotus = Scoring & Readiness Framework.
**Full text:** `docs/doctrine/blume-q1-q2-q3-resolution.md` (+ `blume-doctrine-v1.md`).
**Preserved open:** vault physical-vs-logical representation; Compliance vault review (Sep–Dec 2026).

---
## ADR-001 — Build Ledger as continuity system
**Date:** 2026-06-19 · **Status:** Accepted
**Decision:** BLUME is built via a persistent file-based ledger (`build/`) so any future session resumes with
near-zero context loss. Tasks carry stable `BLUME-###` IDs; state lives in CURRENT_STATE/NEXT_ACTION/COMPLETED.
**Rationale:** the Era-1 Notion system had no Memory layer → doctrine drift / rediscovery. The build must not repeat that.

---
## ADR-002 — BLUME public voice + persona rules
**Date:** 2026-06-19 · **Status:** Accepted (Terravian ruled)
**Decision:** (1) **Public default voice = Calm · Premium · Intelligent · Helpful · Strategic.** (2) **"Mystic-Tech" is a private / optional / House-of-Terravian mode — never the default, never public/enterprise-facing.** (3) **No real copywriter names** as personas — voice library = house voices + style archetypes only.
**Consequence:** generation tools must stop exposing `dominion_rex`/`venus_protocol` publicly (→ BLUME-005); BLUME-214 default = calm-premium.

---
## ADR-003 — Ledger re-baselined against as-built reality
**Date:** 2026-06-19 · **Status:** Accepted
**Decision:** The coverage audit (`COVERAGE_REPORT_v1.md`) found BLUME is **already built** across two servers (`blume/` = BLUME-MCP, `terravian-mcp/` = Terravian-MCP), with the doctrine's MCP split **already realized and mid-migration** (`@terravian/blume` extraction). BLUME-001 ("scaffold server") is obsolete → replaced by BLUME-004 (reconcile). Added systems **S20–S27** to track already-built infra (events, queue, workflows, approvals, listings, affiliate, gateway, signals).
**Rationale:** prevent a future builder from rediscovering a live subsystem and asking "why wasn't this in the ledger?" — the stated success criterion.
**Genuine remaining gaps:** ★ Lotus Engine (S4) + the Artifact/Router-Tag spine (S1/S2). **Out of scope (separate ledgers):** Delegatrix™ / WTH! Dispatch™; the Terravian AI Council (Terravian-MCP multi-agent decision; its 600+pg archive still needs a dedicated read).

---
## ADR-004 — Doctrine & Taxonomy FROZEN; Lotus is the primary objective
**Date:** 2026-06-19 · **Status:** Accepted (Noo1 advisory, Terravian-relayed)
**Decision:**
1. **Doctrine frozen** — no further doctrine work unless implementation surfaces a genuine contradiction.
2. **Taxonomy frozen** — no further vault redesign unless implementation reveals a structural flaw.
3. **Build order locked:** BLUME-004 → BLUME-005 → **Artifact Spine (S1/S2)** → **Lotus Engine (S4)** → Vault Migration (8→12, BLUME-032).
4. **Lotus = primary objective.** Value chain: Spine creates truth → Lotus creates judgment → prioritization → revenue.
5. **Prioritization gate:** every future architectural proposal must answer **"Does this accelerate Lotus?"** — if not, defer.
6. **Milestone declared:** `MILESTONE: FIRST LOTUS SCORE` (`build/MILESTONE_FIRST_LOTUS_SCORE.md`) — a brand receives Content/Audience/Offer/Proof/Monetization scores + Launch Readiness Index. Crossing it = storage system → intelligence system.
**Consequence:** PR #1 + PR #2 merged; specs are sufficient to survive interruption/context-loss/new developers. Spec phase CLOSED — next sessions BUILD, not specify.
