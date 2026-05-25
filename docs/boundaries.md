# BLUME System Boundaries

**Date:** 2026-05-25
**Status:** Canonical — locked

This document defines ownership and runtime responsibility across all four systems in the Terravian empire stack. Boundaries define *who owns what*, not what is currently implemented where. Current duplication is tracked explicitly and is temporary by design.

---

## Principle

> BLUME generates. Terravian-MCP orchestrates. STEALTHAPI posts. Supabase persists.

Boundaries do not reduce capabilities. They assign canonical ownership so the stack evolves in one direction: terravian-mcp calls BLUME, not the reverse; BLUME hands output to the queue, not to the platform.

---

## 1. What BLUME Owns

BLUME is the canonical owner of all generation logic, brand logic, vault logic, and signal intake. Any feature in these domains belongs here — whether or not terravian-mcp currently has a copy.

### Content Generation
- Social post generation (all platforms, all modes)
- AIDA sequence generation (4-post sequences)
- Offer generation
- Email generation (welcome, nurture, conversion)
- SEO content generation (meta title, description, H1, intro, social posts)
- Festival SEO page generation
- Brand voice system prompt construction
- BLUME mode definitions (collaborative, dominion_rex, venus_protocol, commerce, insight, grace)
- PLATFORM_LIMITS (character limits per platform)

### Brand Intelligence
- BrandProfile schema (canonical definition)
- Brand registry CRUD (load, list, add, remove)
- 7 Sales Switches™ definitions and diagnosis
- Site analysis and strategic recommendations
- diagnoseBrand logic

### Vault System
- VaultEntry schema (canonical definition)
- VAULT_NAMES and VAULT_DESCRIPTIONS (canonical)
- Vault initialization (per-brand, 8 vaults)
- Vault writes (local filesystem — source of truth)
- Vault reads and search
- Vault backup to Supabase (fire-and-forget, not blocking)

### Listing Pipelines
- Festival pipeline stages as pure functions (ingest, dedup, seo_page_generate, publish)
- Festival record schema (canonical definition)
- All future vertical pipelines (apartments, local pages, etc.)

### Signal Intake (Phase 2)
- SERP signal ingestion
- Google Events ingestion
- Google Maps ingestion
- YouTube ingestion
- News ingestion
- Manual signal submission

### MCP Surface
- Standalone MCP server exposing all BLUME tools
- All `blume_*` tool definitions
- All `festival_*` tool definitions
- All `vault_*` tool definitions
- All `seo_*` tool definitions

---

## 2. What Terravian-MCP Owns

Terravian-MCP is the canonical owner of all orchestration, execution, scheduling, event routing, and observability. It is the spine of the empire. It may call BLUME but should not implement BLUME internals.

### Op Queue Daemon
- thq_op_queue daemon (polls, executes, retries, fails)
- Task handler registration and dispatch
- Task retry logic and failure tracking
- Op task status reporting

### Scheduling
- thq_blume_queue (scheduler queue for timed posts)
- Post scheduling logic (when to post, to what account)
- Bulk schedule dispatch
- Schedule cancellation

### Event System
- Event subscription management (thq_event_subscriptions)
- Event routing (which handlers receive which events)
- Event acknowledgment and failure handling
- thq_op_queue_events (op task lifecycle events)

### Social Posting
- STEALTHAPI gateway integration (multi-platform posting)
- Twitter/X API direct integration
- Post approval queue (human approval gate)
- blume_post / blume_tweet tool implementations

### Observability
- system_health reporting
- failure_feed aggregation
- approval_queue management
- Analytics summary

### Workflow Engine
- workflow_list / workflow_run / workflow_status
- Multi-step cross-system workflows

### Orchestration MCP Surface
- All orchestration tools (`op_task_*`, `queue_*`, `event_*`, `workflow_*`, `approval_*`, `failure_*`, `analytics_*`)
- Any tool that bridges BLUME output → social posting
- Any tool that commands cross-system state transitions

---

## 3. What STEALTHAPI Owns

STEALTHAPI is the canonical posting gateway. It is a runtime service, not a repo with logic.

- Multi-platform OAuth token management
- Platform API rate limiting and queueing
- Post submission to Twitter/X, Instagram, LinkedIn, Facebook, TikTok, YouTube
- Post status and delivery confirmation
- Media upload handling

STEALTHAPI does **not** generate content. It receives finalized content from terravian-mcp and executes delivery.

---

## 4. What Supabase Owns

Supabase is the persistence layer. It does not own logic — it owns durable state.

| Table                    | Primary Owner    | Access Pattern                                           |
| ------------------------ | ---------------- | -------------------------------------------------------- |
| `thq_festivals`          | BLUME            | BLUME writes full records; terravian-mcp reads for tasks |
| `thq_vault_entries`      | BLUME            | BLUME writes (async backup); reads are local-first       |
| `thq_op_queue`           | Terravian-MCP    | BLUME creates tasks; daemon executes and updates status  |
| `thq_op_queue_events`    | Terravian-MCP    | Internal to daemon — BLUME does not write here           |
| `thq_events`             | Terravian-MCP    | BLUME emits events; terravian-mcp routes subscriptions   |
| `thq_event_subscriptions`| Terravian-MCP    | BLUME does not manage subscriptions                      |
| `thq_blume_queue`        | Terravian-MCP    | Scheduler queue — BLUME does not write here              |

**Vault local files are always the source of truth.** Supabase vault records are an async backup only. Any read that requires accuracy must read the local filesystem first.

---

## 5. What Should Remain Duplicated Temporarily

These exist in both `terravian-mcp` and `blume` right now. This duplication is intentional and should not be resolved until BLUME is fully stable and terravian-mcp is refactored to import from BLUME.

| Capability                              | terravian-mcp location              | blume location                   |
| --------------------------------------- | ----------------------------------- | -------------------------------- |
| `generatePost` and generation functions | `src/agents/blume/index.ts`         | `src/content/generator.ts`       |
| `BrandProfile` + brand registry         | `src/memory/brands.ts`              | `src/brands/registry.ts`         |
| Persona / mode system                   | `src/agents/blume/persona.ts`       | `src/content/persona.ts`         |
| SEO generation                          | `src/agents/blume/seo.ts`           | `src/content/seo.ts`             |
| 7 Sales Switches™                       | `src/agents/blume/switches.ts`      | `src/content/switches.ts`        |
| Vault system                            | `src/agents/blume/vault.ts`         | `src/vault/index.ts`             |
| Festival types                          | `src/festivals/types.ts`            | `src/listings/festivals/types.ts`|
| MCP BLUME tools                         | `src/server.ts` (blume_* tools)     | `src/mcp/server.ts`              |

**Do not remove these from terravian-mcp yet.** Both MCP servers run in parallel while BLUME is validated in production.

---

## 6. What Should Be Migrated Later (Phase 2)

Once BLUME is stable in production:

1. **terravian-mcp → import from blume package** — replace all duplicated BLUME logic in terravian-mcp with `import { generatePost, ... } from "@terravian/blume"`. Terravian-MCP becomes a thin orchestration layer that calls BLUME.
2. **Remove `src/agents/blume/` from terravian-mcp** — after import migration is complete and verified.
3. **Remove `src/festivals/types.ts` from terravian-mcp** — use `@terravian/blume` types instead.
4. **terravian-mcp MCP blume_* tools become proxies** — they call BLUME MCP or import BLUME functions directly rather than implementing generation internally.
5. **brands/ directory** — BLUME's `/brands/*.json` files become the source of truth. terravian-mcp reads from BLUME's brands directory or fetches via MCP.

---

## 7. What Should Never Be Duplicated Again

These are architectural red lines. Violating them means the boundaries have broken down.

| What                                               | Rule                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Social posting logic (OAuth, platform API calls)   | Lives only in STEALTHAPI / terravian-mcp bridge. BLUME never touches this.    |
| Op queue daemon logic (polling, retry, dispatch)   | Lives only in terravian-mcp. BLUME never implements a daemon.                 |
| Event subscription management                      | Lives only in terravian-mcp. BLUME emits but never subscribes.                |
| Scheduler queue logic (thq_blume_queue)            | Lives only in terravian-mcp. BLUME never writes to the scheduler queue.       |
| New generation functions built inside terravian-mcp| If it generates content, SEO, or vault entries — it belongs in BLUME first.   |
| New listing pipeline stages built in terravian-mcp | All vertical pipelines belong in BLUME. terravian-mcp only executes tasks.    |
| BrandProfile schema defined twice                  | After Phase 2 migration, one canonical schema in BLUME only.                  |
| Vault entry schema defined twice                   | After Phase 2 migration, one canonical schema in BLUME only.                  |

---

## Decision Rule for Future Features

When a new capability is being designed, answer these questions in order:

1. **Does it generate content, analyze brands, ingest signals, or write to a vault?** → BLUME
2. **Does it post to a social platform or manage OAuth?** → STEALTHAPI / terravian-mcp bridge
3. **Does it schedule, orchestrate multi-system state, or route events?** → Terravian-MCP
4. **Does it persist durable state?** → Supabase (write logic lives in the owning system)
5. **Does it bridge BLUME output to execution?** → Terravian-MCP calls BLUME, not the reverse
