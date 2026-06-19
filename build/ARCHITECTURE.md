# BLUME — ARCHITECTURE (locked invariants)
*The rules a build session must not violate. Source of truth: `docs/doctrine/blume-q1-q2-q3-resolution.md` + `blume-doctrine-v1.md`.*

## Constitutional Layer
- **Vaults** answer *"what happened?"* — records.
- **Lotus** answers *"how healthy is it?"* — scoring & readiness.
- **BLUME** answers *"what should happen next?"* — intelligence.
- **Terravian-MCP** answers *"where should it go?"* — routing.
- **BLUME reads every vault and owns none.**
- **Memory = what happened · Library = what endures.** Memory compounds → wisdom.

## Structural Principle
- Hierarchy: **`Owner → Holding → Brand → Artifact`**.
- **Vaults are category lenses over artifacts**, not ownership entities, not top-level.
- Maps onto the live spine `owner → brand → brand_channel`.

## Canonical Vault Taxonomy (12, tiered by ownership)
- **CORE:** 1 Brand Assets · 2 Published Works · 3 Proof of Use · 4 Commerce Evidence · 5 Creative Drafts · 6 Internal Notes · 7 Legal · 8 Investor
- **EXTENDED:** 9 R&D/Experimental AI · 10 Compliance *(UNDER REVIEW → maybe Operations/Systems, reeval Sep–Dec 2026)*
- **SOVEREIGN (trustee-only, House of Terravian/TFT, never product):** 11 Memory · 12 Library of Toravian
- Esoteric vault **retired** → merged into Library. Competitor/Rival vaults **retired**; competitive awareness lives in **R&D** (benign only), not Compliance.

## Router-Tag Contract (BLUME-MCP ↔ Terravian-MCP)
`{ uuid, brand, vault, switch, title, timestamp, version, source, hash, metadata }`
- Every artifact carries it. This same schema enables **logical vault views**: "Vault X" = `WHERE brand=B AND vault=X`.

## S.T.E.A.L.T.H. (7-part)
Secure the Signal · Timestamp in Public · Enshrine the Evidence · Activate in Commerce · Lock in Legal Armor · Tangle the Terrain · Haunt Their Hand.

## Lotus Engine
A **Scoring & Readiness Framework** — NOT a vault/brand/MCP/dashboard. Above the vaults. Owns Health Bar · Tick Maps · Launch Readiness Index · Content/Audience/Offer/Proof/Monetization scoring · missing-evidence · bottleneck · readiness summaries. Owned by **BLUME-MCP**; outputs routed by Terravian-MCP.

## Ownership / Permission (reality-first)
- **SlateRiver LLC (NM)** owns BLUME IP today · ExpandedAwareness.io IP Holdings = IP DBA · MCM = operator, never owner.
- Future `TFT → TDT → ops` modeled as **planned parents** until notarized.
- **Terravian-MCP permission root = SlateRiver now**, forward-compatible re-parenting (zero rework).
- Public footer: never "MCM Enterprises LLC".

## MCP Boundary
- **BLUME-MCP owns:** vault taxonomy · router-tag · **Lotus (all scoring/readiness)** · sales switches · intelligence.
- **Terravian-MCP owns:** cross-brand routing · ownership/permission · House-wide orchestration.

## Open architectural questions (do NOT pre-decide — decide at build time)
- **Vault representation:** physical containers vs metadata-driven views. *Lean: artifacts-first / views.*
- **Compliance (Vault 10):** keep vs evolve → Operations/Systems. Reeval Sep–Dec 2026.

## Stack context (existing)
- Supabase project `wxinipsficonhfifjqek` (live); `sapi_*` tables are the present canonical data.
- StealthAPI = canonical publish gateway (publish path needs `.from()` repoint to `sapi_*`).
- Brand spine: `owner → brand → brand_channel` (ADR-001 tenancy: single→multi is free).
