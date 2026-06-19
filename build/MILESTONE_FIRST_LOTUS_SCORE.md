# MILESTONE: FIRST LOTUS SCORE
**Declared:** 2026-06-19 (Noo1 advisory; Terravian-relayed) · **Status:** ACTIVE — the next meaningful finish line.
**Why it matters:** crossing this line moves BLUME **from a storage system to an intelligence system.**

---

## Definition (done = all true)
A brand can enter the system and receive:
- [ ] **Content Score** (0–20)
- [ ] **Audience Score** (0–20)
- [ ] **Offer Score** (0–20)
- [ ] **Proof Score** (0–20)
- [ ] **Monetization Score** (0–20)
- [ ] **Launch Readiness Index** (0–100% + band: Go ≥85 / Final-Prep 70–84 / Structuring 50–69 / Dev <50)

**Acceptance test:** `lotus_readiness(<brand>)` returns the five sub-scores + index + band, computed from artifacts ingested through the Spine, for any of the 26 brands — with no per-brand code.

## The value chain (why Lotus is the primary objective)
> Artifact Spine creates **truth** → Lotus creates **judgment** → judgment creates **prioritization** → prioritization creates **revenue** → revenue funds the empire.

## The shortest path to this milestone
```
BLUME-004  Reconcile existing servers vs ledger
   ↓
BLUME-005  Voice cleanup (retire public dominion_rex/venus_protocol; calm-premium default)
   ↓
ARTIFACT SPINE   (S1/S2)  — build/ARTIFACT_SPINE_SPEC_v1.md  →  thq_artifacts + router-tag + validator + ingest/list
   ↓
LOTUS ENGINE     (S4)     — build/LOTUS_ENGINE_SPEC_v1.md    →  C/A/O/P/M scoring + Launch Readiness Index  ◀── MILESTONE HIT HERE
   ↓
VAULT MIGRATION  (BLUME-032, 8→12)
```
**Minimum to hit the milestone:** the Spine must expose `artifact_list(brand, vault?, switch?)`; Lotus must expose `lotus_readiness(brand)` returning the 5 sub-scores + index + band. Everything else (Health Bar, missing-evidence, bottleneck, Tick Maps, investor summary) is **post-milestone polish** (Wave 2) — do not let it block the first score.

## The prioritization gate (apply to every future proposal until milestone hit)
> **"Does this accelerate Lotus?"** — if not, **defer it.**

## Frozen (do not reopen — see DECISIONS ADR-004)
- **Doctrine** — frozen. Reopen only if implementation surfaces a genuine contradiction.
- **Taxonomy** — frozen. Reopen only if implementation reveals a structural flaw.
