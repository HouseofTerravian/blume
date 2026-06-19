# BLUME Doctrine — Q-1 / Q-2 / Q-3 Resolution (Doctrine Lock)

**Status:** Canonical · resolves Doctrine v1 Open Questions Q-1, Q-2, Q-3 · **doctrine CLOSED** unless operational evidence justifies future change
**Ruled by:** Noo1 (advisory, multiple cycles) · **Decided by:** Chude / Terravian (final authority)
**Date:** June 19, 2026
**Scope:** Locks BLUME's constitutional layer, structural principle, canonical vault taxonomy, ownership stack, and Lotus Engine classification. Opens the BLUME-MCP build gate.

> **Origin.** Multiple review cycles across the Era-1 source documents, the BLUME codices, the actual Notion vault architecture, the router-tag contract, the Lotus Engine specs, the ownership-stack docs, and Noo1 architectural advisory. Empirical Notion-structure findings recorded separately (see §11). Noo1 advises; Terravian decides.

---

## 1. The Constitutional Layer (keystone)

The role-confusion firewall for the entire ecosystem:

> **Vaults answer:** *"What happened?"*
> **Lotus answers:** *"How healthy is it?"*
> **BLUME answers:** *"What should happen next?"*
> **Terravian-MCP answers:** *"Where should it go?"*

**Ownership firewall.** BLUME may *read* from every vault. **BLUME owns none of the vaults.** Vaults are records · Lotus is scoring · BLUME is intelligence · Terravian-MCP is routing.

**Memory ↔ Library.** **Memory = what happened. Library = what endures.** Memory compounds → compounded memory becomes wisdom → wisdom improves future decisions. The Library of Toravian preserves that wisdom.

---

## 2. Structural Principle — vaults are subordinate to brands

Canonical hierarchy (observed in the actual Notion implementation, §11):

```
Owner → Holding → Brand → Artifact
```

- Vaults are **not** ownership entities. **Vaults are category lenses applied to artifacts.**
- This maps directly onto the live spine `owner → brand → brand_channel`.
- The historical Notion implementation duplicated vaults **physically** under every brand. **BLUME-MCP is not required to do so.**
- **Implementation remains an intentional OPEN architectural question** (see §10-O2): (A) physical vault containers, or (B) metadata-driven vault views over a shared per-brand artifact store. Doctrine does not decide this; the build phase does. Suspected end-state: *artifacts first, vaults second.*

---

## 3. Canonical Vault Taxonomy

Three tiers — naming chosen so the boundary reads as **ownership**, not a pricing ladder. (The 12-vault set was historically *operational* in Notion, not theoretical; §11.)

**CORE**
1. Brand Assets
2. Published Works
3. Proof of Use
4. Commerce Evidence
5. Creative Drafts
6. Internal Notes
7. Legal
8. Investor

**EXTENDED**
9. R&D / Experimental AI
10. Compliance *(UNDER REVIEW — see §10-O1)*

**SOVEREIGN** — House of Terravian only; never product or enterprise positioning
11. Memory
12. Library of Toravian

### Vault notes
- **Memory (11)** stores: doctrine decisions · ADRs · project histories · lessons learned · postmortems · implementation discoveries · founder journals · cross-brand learnings.
- **Library of Toravian (12)** stores: Law of One / LL Research materials · lineage teachings · metaphysical frameworks · symbolic systems · codices · rituals · preserved wisdom · House legacy.
- **Esoteric Vault is RETIRED.** Its contents merge into the Library of Toravian (its proper, usage-consistent home; §11). Consistent with Doctrine v1 §C-1 — mysticism stays out of product.

---

## 4. R&D Scope

R&D / Experimental AI (Vault 9) contains:
- Market Intelligence
- Competitive Awareness — **benign awareness only**
- Industry Trends
- Experimental Research

**Competitor Vault and Rival Dashboard remain retired.** No warfare doctrine, no rival suppression, no shadow-launch tooling (Doctrine v1 §C-2). Competitive awareness belongs under **intelligence (R&D)**, not **governance (Compliance)**.

---

## 5. S.T.E.A.L.T.H. (canonical 7-part — ratified, unchanged)

Secure the Signal · Timestamp in Public · Enshrine the Evidence · Activate in Commerce · Lock in Legal Armor · Tangle the Terrain · Haunt Their Hand. (Doctrine v1 §R-1.)

---

## 6. Ownership Stack — reality first, intent second

**Present legal reality (build permission logic on THIS):**
- **SlateRiver LLC (NM)** owns BLUME-related IP today.
- **ExpandedAwareness.io IP Holdings** = the IP-holding DBA.
- **MCM Enterprises** = operator, **never owner**.

**Future intended structure (model as planned parents until legally established):**
```
TFT → TDT → Operating Entities
```
Trust structures (Terravian Family Trust → Toravian Dynasty Trust) are **not yet notarized**; they are modeled as future parents. **Terravian-MCP permission logic keys off present reality (SlateRiver root) and remains forward-compatible with re-parenting** to TFT/TDT on notarization — zero rework (mirrors the ADR-001 tenancy approach: single → multi-entity is free).

**Sovereign tier home.** Memory (11) + Library of Toravian (12) map to TFT / House of Terravian, trustee-only.

**Public copy rule.** Never "MCM Enterprises LLC". Footer = *"ExpandedAwareness.io IP Holdings, a DBA of SlateRiver LLC, a New Mexico LLC."*

---

## 7. Lotus Engine — classification

Lotus Engine is a **first-class BLUME subsystem that sits ABOVE the vaults.**

Lotus Engine is **NOT**: a Vault · a Brand · an MCP · a Dashboard.
Lotus Engine **IS**: **a Scoring and Readiness Framework.**

**Lotus owns:** Health Bar · Tick Maps · Launch Readiness Index · Content / Audience / Offer / Proof / Monetization scoring · missing-evidence detection · bottleneck detection · readiness summaries.

- Tick Maps **may** be persisted as artifacts (e.g. in Investor Vault). **Lotus itself is not a vault.** Lotus **reads across** vaults and **generates** scores, reports, and readiness artifacts.

---

## 8. MCP Build Boundary (confirmed)

- **BLUME-MCP owns:** vault taxonomy · router-tag metadata (`{uuid, brand, vault, switch, title, timestamp, version, source, hash, metadata}`) · **Lotus** (all scoring + readiness) · sales switches · BLUME intelligence.
- **Terravian-MCP owns:** cross-brand routing of artifacts and Lotus outputs · ownership/permission logic (SlateRiver-root → future TFT/TDT) · House-wide orchestration.
- **Contract:** the router-tag schema. The same schema already enables logical (view-based) vaults — "Vault X" = `WHERE brand=B AND vault=X` — so §2-O2 needs no schema change to resolve either way.

---

## 9. Resolved Open Questions (amends Doctrine v1)

- **Q-1 — Canonical vault taxonomy → RESOLVED.** §3 above (12-vault, Core/Extended/Sovereign; Esoteric→Library; Competitor/Rival dropped; numbering locked).
- **Q-2 — Ownership stack → RESOLVED.** §6 above (SlateRiver-root now; TFT/TDT modeled as future parents).
- **Q-3 — Private lineage location → RESOLVED.** Sovereign tier (Memory 11 + Library 12), House-of-Terravian/TFT, trustee-only, never in product (§3, §6).

---

## 10. Preserved Open Questions (intentional — do NOT block the build)

- **O1 — Compliance (Vault 10) under review.** Active for now. Its contents (privacy policies, contracts, licensing, regulations, filings, SOP requirements) largely overlap **7 Legal** and **11 Memory**. **Reevaluate after operational usage — review window September–December 2026.** Candidate evolution: **Compliance → Operations** or **→ Systems** (broader: SOPs, workflows, automations, infrastructure, integrations, deployment, governance — which BLUME generates constantly). No action now.
- **O2 — Vault representation: physical vs logical.** §2 above. (A) physical containers vs (B) metadata-driven views over a shared artifact store. Decide at build time on real usage. Suspected end-state: artifacts-first.
- **Carried from v1 (unchanged):** Q-4 vault↔schema mapping (intent ratified; binding = build phase) · Q-5 naming convention · Q-6 BLUME Switches ↔ ASSIST front office · Q-7 founder-intelligence boundary.

---

## 11. Discrepancy Notes — actual Notion vault structure

Empirical review of how BLUME was *actually* organized in Era-1 Notion (full detail in the project-memory note `project_blume_notion_structure_review`):
1. **Vaults were subordinate to brands**, not top-level (`Owner → Holding → Brand → Vault → Artifact`) — grounds §2.
2. **The 12-vault model was operational**, not theoretical — grounds §3 as ratified baseline.
3. **Esoteric and Library were converging** to the same destination — grounds the Esoteric→Library merge (§3).
4. **There was NO dedicated Memory vault** — its absence caused doctrine drift, architecture rediscovery, and repeated reinvention — the strongest justification for Memory (11).
5. **Compliance was the least-justified permanent vault** — grounds O1.

---

## 12. Build Doctrine

Do **not** estimate the final BLUME vision or the completed empire. **Build the smallest machine that proves the doctrine.**

Priority order: **1) Spine · 2) Visibility · 3) Reliability · 4) Scale.**

Repeated question: *"What is the smallest working BLUME-MCP that demonstrates the doctrine?"*

---

## NEXT MOVE

**Build BLUME-MCP — begin with the smallest functioning spine, not the final system.**

---

*Authority: Terravian is final authority. Noo1 advises and certifies; Terravian decides. Doctrine is CLOSED unless operational evidence justifies a future, dated amendment.*
