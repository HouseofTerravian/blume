# BLUME — NEXT ACTION
*The single next task. Do this, then update CURRENT_STATE + COMPLETED + this file.*

## ▶ BLUME-004 — Reconcile the two existing servers against the ledger
**Wave:** 1 · **System:** S0 Foundation · **Deps:** none
*(Replaces the obsolete BLUME-001 "scaffold a server" — the servers already run. See `COVERAGE_REPORT_v1.md`.)*

**Context:** BLUME is **already built** across two repos:
- **`C:\dev\active\blume` = BLUME-MCP** — `src/mcp/server.ts`: generation (post/AIDA/offer/email/SEO), 8 CORE vaults, 26 brands, `vault_search`, festivals pipeline.
- **`C:\dev\active\terravian-mcp` = Terravian-MCP** — BLUME agent + `adapters/blume.ts` bridge to `@terravian/blume`, social gateway, scheduler+daemon, events, queue+handlers, workflows, observability, approvals.

**Do:**
- Walk both servers; confirm the as-built status overlay in `BUILD_LEDGER.md` (mark DONE the items listed there).
- Document the in-flight `@terravian/blume` package extraction (the BLUME-MCP↔Terravian-MCP split is mid-migration — finish it, don't fork).
- Confirm the **genuine gaps**: ★ **S4 Lotus Engine** and **S1/S2 artifact + router-tag spine** are absent.

**Done when:** the ledger's Master Task Table reflects true as-built status, and the Lotus + artifact-spine gaps are confirmed as the next real build targets.

**Then, in order (Spine BEFORE Lotus — Lotus reads the Spine):**
1. **BLUME-005** — retire public `dominion_rex`/`venus_protocol` modes → private; set calm-premium house voice default.
2. **★ S1/S2 Artifact + Router-Tag spine** (BLUME-003/010/011/020/021) — per **`build/ARTIFACT_SPINE_SPEC_v1.md`**. The canonical `thq_artifacts` contract the vaults currently lack (no uuid/switch/version/source/hash today).
3. **★ S4 Lotus Engine** (BLUME-040 → 043) — per **`build/LOTUS_ENGINE_SPEC_v1.md`**. C/A/O/P/M scoring → Launch Readiness Index → `lotus_readiness(brand)`. Reads artifacts via the Spine.
4. **BLUME-032** — vault enum migration 8→12 (add 9 R&D, 11 Memory, 12 Library; 10 Compliance parked).

**Both specs are build-ready — no further doctrine phase required.**

**One-time build-start confirms (still open with Chude):**
1. Where Lotus lives — extend `blume/` (BLUME-MCP) — confirmed direction; verify.
2. Storage for artifacts/scores: `blume_*` schema vs reuse `sapi_*` on Supabase `wxinipsficonhfifjqek`.
3. Finish the `@terravian/blume` extraction vs keep BLUME embedded in terravian-mcp.
