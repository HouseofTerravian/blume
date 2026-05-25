# BLUME — Claude Code Context

## What this repo is
BLUME is the standalone content + listing generation engine for the Terravian empire.
It was migrated from `terravian-mcp` on 2026-05-25 and lives at `HouseofTerravian/blume`.

## Current state (2026-05-25)
- Phase 1 complete: all BLUME generation, vault, brand, festival, SEO tools are live
- Standalone MCP server running at `src/mcp/server.ts`
- Registered as `blume` MCP server in `~/.claude.json` (alongside terravian-mcp)
- Baby bridge active: `blume_list_brands` in terravian-mcp now calls `@terravian/blume` via npm link

## Baby bridge status
- Only tool migrated: `blume_list_brands`
- Adapter lives at: `terravian-mcp/src/adapters/blume.ts`
- npm link active: `terravian-mcp/node_modules/@terravian/blume` → this repo's dist/
- Verification checklist: `docs/blume-baby-bridge-verification.md`

## Immediate next action (BLOCKED — waiting on verification)
Verify both MCP servers after Claude Code restart:
1. Call `mcp__blume__blume_list_brands` → expect 26 brands
2. Call `mcp__terravian-mcp__blume_list_brands` → expect 26 brands (already confirmed ✓)
3. If both pass → gate G1–G10 open → tool #2 migration (`blume_vault_summary`) may begin

## Do NOT do yet
- Do not migrate `blume_vault_summary` or any other tool until verification is confirmed
- Do not remove old BLUME code from terravian-mcp
- Do not publish `@terravian/blume` to npm yet

## Key docs
- `docs/architecture.md` — module map + data flows
- `docs/boundaries.md` — canonical ownership per system
- `docs/phase-2-migration-plan.md` — full adapter strategy, 42-tool inventory, migration order
- `docs/blume-baby-bridge-verification.md` — runtime checklist + 10-gate decision gate
- `docs/migration.md` — source → destination map from terravian-mcp

## Smoke test
```bash
cd C:/dev/active/blume
node smoke-test.mjs
# Expect: 5/5 passed
```

## Repos
- BLUME: `github.com/HouseofTerravian/blume` | local: `C:/dev/active/blume`
- terravian-mcp: `github.com/HouseofTerravian/terravian-mcp` | local: `C:/dev/active/terravian-mcp`
