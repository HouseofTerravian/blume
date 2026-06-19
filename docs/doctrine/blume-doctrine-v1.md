# BLUME Doctrine v1

**Status:** Canonical · v1
**Ruled by:** Noo1 (advisory) · **Decided by:** Chude / Terravian (final authority)
**Date:** June 19, 2026
**Scope:** Governs BLUME ("BLOOM") philosophy, positioning, and the BLUME-MCP / Terravian-MCP build boundary.

> **Origin.** Distilled from the Era-1 BLUME archive (the *Is Alive* one-pager, the S.T.E.A.L.T.H. Integration matrix, the Vault Mapping System, the 12-Vault Codex, and the 280-page development log), examined for philosophical principles, then adopted / ratified / challenged by Noo1 and decided by Terravian. Noo1 advises; Terravian decides.

---

## The Core Thesis (Adopted)

**BLUME is a living proof-of-commerce intelligence system.**

Every artifact a brand produces — post, screenshot, receipt, draft, listing — is a *timestamped, un-backdatable proof entry* (a "heartbeat") that does **double duty**: it markets the brand **and** defends its IP at the same time. Over time these entries become living timelines of proof-of-commerce that are impossible to fake or backdate.

The "living system" is a **structural metaphor, not a metaphysical claim** (see Retired §R-1):
- **Body** = the Vault System (structured artifact storage)
- **Heartbeat** = proof entries (timestamped artifacts)
- **Nervous system** = S.T.E.A.L.T.H. (every action tagged for marketing + defense)
- **Brain** = automation + BLUME intelligence (scoring, readiness, switches)
- **Memory/lineage** = private vault content (trustee/founder only)

---

## Adopted Principles

- **A-1 — Living proof-of-commerce intelligence.** The core thesis above. BLUME exists to generate, store, and compound proof of real commercial activity.
- **A-2 — Proof-of-Commerce as heartbeat.** Every artifact is a timestamped, un-backdatable proof entry. (Consistent with the House rule that a pushed/archived, timestamped record is the proof point.)
- **A-3 — Double-duty doctrine.** Every action runs marketing **and** legal/IP defense simultaneously. Nothing BLUME does is single-purpose.
- **A-4 — Router-tag metadata schema.** Every artifact carries structured metadata — `{ source, switch, vault, uuid, version, timestamp }` — so it can be routed, scored, and proven. This is the technical contract between BLUME-MCP and Terravian-MCP.
- **A-5 — Vault Health / Launch-Readiness.** Brand readiness is derived from proof density and vault completeness — a measurable signal, not a guess.
- **A-6 — Sales Switchboard (7 Switches).** BLUME operates a funnel: (1) Identity & Signal, (2) Audience Building, (3) Traffic Generation, (4) Trust & Story, (5) Conversion, (6) Retention & Referrals, (7) Scaling Intelligence. Each switch maps to one or more vaults. (Note synergy: this maps cleanly onto the ASSIST "front office" motion — to be unified or kept parallel, see Q-6.)

---

## Ratified Principles

- **R-1 — S.T.E.A.L.T.H. (canonical 7-part).** Every artifact is tagged against this matrix so that marketing output simultaneously builds legal/IP defense:
  1. **S** — Secure the Signal
  2. **T** — Timestamp in Public
  3. **E** — Enshrine the Evidence
  4. **A** — Activate in Commerce
  5. **L** — Lock in Legal Armor
  6. **T** — Tangle the Terrain
  7. **H** — Haunt Their Hand
  *(This supersedes earlier 6-letter renderings that dropped "Enshrine the Evidence.")*
- **R-2 — The Vault System.** Structured, tagged, timestamped artifact storage is the body of BLUME. *The model is ratified; the exact vault list is not yet final* — the archive drifted 7 → 12 → 13 vaults, and the taxonomy must be reconciled with the present brand spine before locking (see Q-1).
- **R-3 — Ethical competitor intelligence.** Competitive *awareness* is a legitimate, ratified function: tracking the market, knowing where rivals stand, informing strategy. It is preserved **only** in this benign form (see Retired §R-2 for what is removed).
- **R-4 — Compartmentalization & IP secrecy.** Ownership/lineage documentation and sensitive internal maps remain access-controlled and are not exposed in operational or public surfaces. Ratified in principle; the exact entity stack must be reconciled (see Q-2).

---

## Challenged / Retired Principles

- **C-1 — Public-facing mysticism is RETIRED.** The "soul / spirit of proof / Pantheon / feminine-coded spirit" framing and the **Esoteric Vault** (sacred geometry, "Law of One" channelings) may exist **only as private lineage/vault content** — never as enterprise positioning, product copy, or customer-facing language. The living-system *metaphor* survives; the *metaphysics* does not. Rationale: collides with the calm, premium, trustworthy, infrastructure-grade standard required for enterprise/healthcare credibility.
- **C-2 — Warfare/empire language is RETIRED publicly.** No "destroy rivals," "suppress competitors," "First Strike Protocol," "Overrun / Most Devastating," "Non-Recoverables," "Dominion Rex," or hostile-empire doctrine in any product or public language. Rationale: directly contradicts the trustworthy-infrastructure posture. (Benign market awareness survives via R-3.)
- **C-3 — Founder pattern-hoarding is REJECTED.** BLUME's SaaS product **must deliver real value to customers.** Withholding the best growth patterns from paying customers to preserve a "founder first-mover edge" is a trust liability and is rejected. Founder-only intelligence **may** exist — but **not** by deliberately weakening the customer-facing product. The line: founder advantage may come from *additional* private intelligence, never from *subtracting* value customers paid for (see Q-7).

---

## Open Questions

- **Q-1 — Canonical vault taxonomy → RESOLVED** (see `blume-q1-q2-q3-resolution.md` §3). Reconcile the 7 / 12 / 13-vault variants into one canonical list, mapped to the present brand spine (`owner → brand → brand_channel`, the `sapi_*` tables, and BLUME's existing 26 brand JSON files). Decide the fate of: Esoteric Vault (→ private only, per C-1), Competitor Vault + Rival Dashboard (→ benign awareness only, per R-3/C-2), and the Library of Toravian (trustee-only).
- **Q-2 — Ownership stack → RESOLVED** (see `blume-q1-q2-q3-resolution.md` §6). The archive describes *Terravian Family Trust → Toravian Dynasty Trust → MCM Enterprises*. Present reality is **SlateRiver LLC (NM) + DBAs** (MCM Enterprises, Muonelo Communications, ExpandedAwareness.io, MyCareerAgent). Determine the canonical ownership/permission model: do the Trusts sit above SlateRiver, alongside, or are they superseded? This blocks Terravian-MCP routing/permission logic.
- **Q-3 — Private lineage location → RESOLVED** (see `blume-q1-q2-q3-resolution.md` §3/§6 — Sovereign tier: Memory 11 + Library 12, House of Terravian/TFT, trustee-only). Where do retired-but-preserved esoteric/lineage materials live (which vault, what access control), so they exist without leaking into positioning?
- **Q-4 — Vault ↔ schema mapping.** Map the canonical vault taxonomy onto the live data model (StealthAPI `sapi_*` tables / publish path) so BLUME-MCP and Terravian-MCP share one source of truth.
- **Q-5 — Naming convention.** Is the canonical wordmark still **BLUME ("BLOOM")** in system docs, or simplified to **BLUME**?
- **Q-6 — BLUME Switches ↔ ASSIST front office.** Unify the "7 Sales Switches" vocabulary with the ASSIST front-office motion (sales / scheduling / intake / service), or keep them as parallel models with a mapping?
- **Q-7 — Founder-intelligence boundary.** Define the explicit line between permissible founder-only intelligence and impermissible product-weakening (operationalizing C-3).

---

## MCP Build Implications

*(Direction only — no code until the Open Questions, especially Q-1 and Q-2, are resolved.)*

**BLUME-MCP owns BLUME properties:**
- Vault taxonomy (canonical list, once Q-1 is resolved)
- Artifact metadata (the router-tag schema, A-4)
- Proof scoring (proof-of-commerce → health, A-2/A-5)
- Launch readiness (A-5)
- Sales switches (A-6)
- BLUME intelligence (the "brain": scoring, readiness, switch logic)

**Terravian-MCP owns cross-brand routing:**
- Where artifacts go — which **entity / brand / vault** receives them
- Ownership & permission logic (gated on Q-2)
- House-wide orchestration across brands

**The contract between them** is the A-4 router-tag metadata schema: BLUME-MCP **produces** tagged, scored artifacts; Terravian-MCP **routes** them to the right entity/brand/vault under the ownership/permission model. Lock the schema and the taxonomy first; both MCPs build against that shared source of truth.

---

*Authority: Terravian is final authority over this doctrine. Noo1 advises and certifies; Terravian decides. This is v1 — amendable as Open Questions are resolved.*
