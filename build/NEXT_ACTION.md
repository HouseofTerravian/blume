# BLUME — NEXT ACTION
*The single next task. Do this, then update CURRENT_STATE + COMPLETED + this file.*

## ▶ BLUME-005 — Voice cleanup (doctrine-debt)
**Wave:** 1 · **System:** S18 Voice/Persona · **Deps:** BLUME-004 (DONE) · **Status:** READY

**Context (verified in BLUME-004):** the generation tools still expose retired modes publicly. `blume_generate_post` / `blume_aida_sequence` accept `mode ∈ {collaborative, dominion_rex, venus_protocol, commerce, insight, grace}`. Per ADR-002, `dominion_rex` (warfare "Dominion Rex") and `venus_protocol` are **retired-doctrine** modes and must not be public defaults.

**Do:**
- In `blume/src/content/persona.ts` (+ `blume/src/mcp/server.ts` enums) and `terravian-mcp/src/agents/blume/persona.ts`: remove `dominion_rex`/`venus_protocol` from the **public** mode enum (or gate them behind a private/House-of-Terravian flag, not selectable by default).
- Set the **public default voice = Calm · Premium · Intelligent · Helpful · Strategic** (ADR-002). `collaborative` (or a renamed calm-premium default) is the default mode.
- Keep behavior backward-safe: callers passing a removed mode fall back to the calm-premium default rather than erroring.

**Done when:** public generation tools no longer offer `dominion_rex`/`venus_protocol`; default output is calm-premium; no caller breaks.

**Scope guard:** voice cleanup only. **Do NOT** build the voice library / A-B testing (BLUME-210+) — that's Wave 4.

**Then, in order (the path to MILESTONE: FIRST LOTUS SCORE):**
1. **★ Artifact Spine (S1/S2)** — `build/ARTIFACT_SPINE_SPEC_v1.md` → `thq_artifacts` + router-tag validator + `artifact_ingest`/`artifact_list`.
2. **★ Lotus Engine (S4)** — `build/LOTUS_ENGINE_SPEC_v1.md` → C/A/O/P/M + `lotus_readiness(brand)`. **← milestone hit.**
3. **BLUME-032** — vault enum migration 8→12.

**Doctrine + taxonomy are FROZEN (ADR-004).** Gate any new idea with *"Does this accelerate Lotus?"* — else defer.
