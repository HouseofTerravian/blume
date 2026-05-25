# BLUME Migration Map

**Date:** 2026-05-25
**From:** `HouseofTerravian/terravian-mcp`
**To:** `HouseofTerravian/blume`

---

## Source Inventory → Destination Map

| terravian-mcp source | blume destination | Status |
|---|---|---|
| `src/agents/blume/index.ts` | `src/content/generator.ts` | Migrated |
| `src/agents/blume/persona.ts` | `src/content/persona.ts` | Migrated |
| `src/agents/blume/seo.ts` | `src/content/seo.ts` | Migrated |
| `src/agents/blume/switches.ts` | `src/content/switches.ts` | Migrated |
| `src/agents/blume/vault.ts` | `src/vault/index.ts` + `src/vault/types.ts` | Migrated |
| `src/agents/blume/cli.ts` | `src/cli.ts` | Migrated |
| `src/memory/brands.ts` | `src/brands/registry.ts` | Migrated |
| `src/festivals/types.ts` | `src/listings/festivals/types.ts` | Migrated |
| `src/queue/handlers/festival.ts` | `src/listings/festivals/pipeline.ts` | Migrated (refactored to pure functions) |
| `src/tools/web/analyzer.ts` | `src/content/analyzer.ts` | Migrated |
| `src/integrations/ai.ts` | `src/integrations/ai.ts` | Migrated |
| `src/integrations/openai.ts` | `src/integrations/openai.ts` | Migrated |
| `src/integrations/anthropic.ts` | `src/integrations/anthropic.ts` | Migrated |
| `src/integrations/supabase.ts` | `src/integrations/supabase.ts` | Migrated (BLUME scope only) |
| `src/config.ts` | `src/config.ts` | Migrated (stripped to BLUME needs) |
| `/brands/*.json` (26 files) | `/brands/*.json` | Copied |
| `src/server.ts` (BLUME tools) | `src/mcp/server.ts` | Rebuilt as standalone |

---

## What Was NOT Migrated (stays in terravian-mcp)

| File | Reason |
|---|---|
| `src/server.ts` (full MCP server) | terravian-mcp remains the orchestration MCP server |
| `src/queue/` (daemon, registry, handlers) | Op queue daemon stays in terravian-mcp |
| `src/events/` | Event routing stays in terravian-mcp |
| `src/workflows/` | Workflow runner stays in terravian-mcp |
| `src/observability/` | Health/failure monitoring stays in terravian-mcp |
| `src/tools/scheduler/` | Post scheduling daemon stays in terravian-mcp |
| `src/tools/social/` | STEALTHAPI gateway + Twitter posting stays in terravian-mcp |

---

## Key Architectural Changes in blume vs terravian-mcp

### Festival pipeline: handlers → pure functions
terravian-mcp used a task handler registration pattern (`registerTaskHandler()`).
In BLUME, each pipeline stage is a plain async function (`ingestFestivals`, `dedupFestivalBatch`, etc.)
that can be called directly or from an MCP tool. The functions still chain stages via `dbCreateTask`,
which the terravian-mcp daemon picks up and executes.

### Supabase integration: scoped
The BLUME supabase integration only includes:
- Vault operations (`thq_vault_entries`)
- Festival operations (`thq_festivals`)
- Minimal task creation (`thq_op_queue` — for pipeline chaining only)
- Event emission (`thq_events` — for pipeline notifications only)

It does NOT include scheduler queue, retry logic, op queue daemon, or event subscription management.

### Content generator: generation only, no posting
`terravian-mcp/agents/blume/index.ts` included `generateAndTweet` and `generateAndPost` which called
the Twitter API and STEALTHAPI gateway. BLUME's `generator.ts` only generates content — it does not post.
Posting stays in terravian-mcp.

### Config: stripped
`terravian-mcp/config.ts` included Twitter tokens, gateway URL, and server identity fields.
BLUME's `config.ts` only includes AI keys, Supabase credentials, vault root, and server identity.

---

## Supabase Tables Reference

| Table | Status | Notes |
|---|---|---|
| `thq_festivals` | Shared (BLUME primary) | Festival records — BLUME owns schema |
| `thq_vault_entries` | Shared (BLUME primary) | Vault archive — BLUME owns schema |
| `thq_op_queue` | Shared (terravian-mcp primary) | BLUME creates tasks, daemon executes |
| `thq_op_queue_events` | terravian-mcp only | BLUME does not write to this |
| `thq_events` | Shared (terravian-mcp primary) | BLUME emits events, does not subscribe |
| `thq_event_subscriptions` | terravian-mcp only | BLUME does not manage subscriptions |
| `thq_blume_queue` | terravian-mcp only | Scheduler queue — stays in terravian-mcp |

---

## Next Steps (Phase 2 Migration)

1. After BLUME standalone is stable and tested, update `terravian-mcp` to import BLUME functions from this package instead of the local duplicates
2. Remove duplicated BLUME code from `terravian-mcp/src/agents/blume/`
3. Remove duplicated festival types from `terravian-mcp/src/festivals/`
4. Keep `terravian-mcp/server.ts` as the orchestration MCP — it will proxy BLUME generation tools or import directly
5. Add Signal Intake Engine (`src/signals/sources/`) once SERP API credentials are configured
6. Add ApartmentEventCalendar vertical (`src/listings/apartments/`) — same pipeline pattern as festivals
