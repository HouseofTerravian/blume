# BLUME — NEXT ACTION
*The single next task. Do this, then update CURRENT_STATE + COMPLETED + this file.*

## ▶ BLUME-001 — Scaffold the BLUME-MCP server
**Wave:** 1 (Spine) · **System:** S0 Foundation · **Deps:** none

**Do:**
- Stand up the BLUME-MCP server (transport + tool registration).
- Expose a trivial `ping` tool that returns `{ ok: true }`.

**Done when:** the server starts and `ping` returns successfully.

**Then:** proceed to **BLUME-002** (connect storage substrate). The spine path is
`001 → 002 → 003 → 010/011 + 020/021 + 030 + 040 → 031 → 041 → 042 → 043`,
ending in a working `readiness(brand)` call.

**Before writing code, confirm with Chude (one-time, build-start):**
1. Language/runtime + MCP framework for BLUME-MCP.
2. Storage: new `blume_*` schema vs reuse `sapi_*` on Supabase `wxinipsficonhfifjqek`.
3. Repo layout for the server (e.g. `src/` in this repo vs a sibling).
