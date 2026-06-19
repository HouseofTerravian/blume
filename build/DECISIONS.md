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
*(Append ADR-002+ here as build decisions are made — e.g. runtime/framework choice, storage schema, vault representation resolution.)*
