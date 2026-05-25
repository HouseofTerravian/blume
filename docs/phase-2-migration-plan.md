# Phase 2 Migration Plan — terravian-mcp → BLUME

**Date:** 2026-05-25
**Status:** Planning only — no code changes, no removals, no migrations executed
**Author:** Terravian empire architecture

---

## Overview

terravian-mcp currently duplicates all BLUME logic internally. Phase 2 makes BLUME the canonical owner: terravian-mcp's BLUME tools are refactored to call BLUME instead of implementing BLUME themselves. This document defines how to execute that safely.

---

## 1. Current terravian-mcp BLUME Tool Inventory

42 tools in `src/server.ts`. Grouped by domain:

### Content Generation (BLUME logic implemented directly in terravian-mcp)
| Tool | Calls | Notes |
|---|---|---|
| `blume_generate_post` | `generatePost()` from `agents/blume/index.ts` | Pure generation — no posting |
| `blume_aida_sequence` | `generateAIDASequence()` | 4-post sequence — pure generation |
| `blume_analyze_site` | `analyzeAndRecommend()` | Site scrape + BLUME analysis |
| `blume_diagnose_switch` | `diagnoseBrand()` | 7 Sales Switches™ diagnosis |
| `seo_generate` | `generateSEOContent()` | SEO content generation |

### Generation + Posting (hybrid — generation is BLUME, posting stays)
| Tool | Calls | Notes |
|---|---|---|
| `blume_post` | `generateAndPost()` | Generates then sends to STEALTHAPI |
| `blume_tweet` | `generateAndTweet()` | Legacy Twitter-only version of `blume_post` |

### Brand Registry (BLUME logic implemented directly)
| Tool | Calls | Notes |
|---|---|---|
| `blume_list_brands` | `getBrands()` from `agents/blume/index.ts` | Read-only brand list |
| `blume_add_brand` | `registerBrand()` + `initVaults()` | Creates brand JSON + vaults |
| `blume_remove_brand` | `deregisterBrand()` | Removes brand JSON, preserves vaults |

### Vault System (BLUME logic implemented directly)
| Tool | Calls | Notes |
|---|---|---|
| `blume_init_vaults` | `initVaults()` | Creates 8-vault directory structure |
| `blume_vault_summary` | `getVaultSummary()` | Entry counts per vault |
| `blume_read_vault` | `readVault()` | Returns vault entries |
| `blume_log_to_vault` | `saveToVault()` | Manual vault write |
| `vault_search` | `searchVaults()` | Full-text search across vaults |

### Scheduling (terravian-mcp owns — not migrating)
| Tool | Calls | Notes |
|---|---|---|
| `blume_list_scheduled` | `listScheduledPosts()` | Scheduler queue read |
| `blume_schedule_post` | `schedulePost()` | Queue a timed post |
| `blume_bulk_schedule` | `bulkSchedule()` | Batch queue |
| `blume_cancel_post` | `cancelScheduledPost()` | Cancel pending post |
| `queue_list` | `queueList()` | Supabase queue read |
| `task_status` | `getTaskStatus()` | Single task detail |
| `task_retry` | `retryTask()` | Manual retry |

### Op Queue (terravian-mcp owns — not migrating)
| Tool | Calls | Notes |
|---|---|---|
| `op_task_create` | `createTask()` | Create op queue task |
| `op_task_list` | `listTasks()` | List op tasks |
| `op_task_status` | `getTask()` | Task + event history |
| `op_task_retry` | `manualRetryTask()` | Manual re-queue |
| `op_task_cancel` | `cancelTask()` | Cancel task |
| `approval_respond` | `respondToHuman()` | Human approval gate |

### Event System (terravian-mcp owns — not migrating)
| Tool | Calls | Notes |
|---|---|---|
| `event_emit` | `emit()` | Emit to thq_events |
| `event_list` | `getRecentEvents()` | Read event log |
| `event_subscribe` | `subscribe()` | Create event → task rule |
| `event_unsubscribe` | `unsubscribe()` | Deactivate subscription |
| `event_subscriptions_list` | `listSubscriptions()` | List all rules |

### Observability + Workflow (terravian-mcp owns — not migrating)
| Tool | Calls | Notes |
|---|---|---|
| `system_health` | `getSystemHealth()` | Stack-wide health |
| `approval_queue` | `getApprovalQueue()` | Tasks awaiting human |
| `failure_feed` | `getFailureFeed()` | Recent failures |
| `analytics_summary` | aggregates vault + queue + events | Cross-system view |
| `workflow_run` | `runWorkflow()` | Multi-step workflow |
| `workflow_list` | `listWorkflows()` | Available workflows |
| `workflow_status` | `getWorkflow()` | Workflow task summary |

### Festival Pipeline (split ownership)
| Tool | Calls | Notes |
|---|---|---|
| `festival_sync` | `createTask()` → daemon → BLUME handlers | terravian-mcp creates the task; daemon calls BLUME pipeline |
| `festival_list` | `dbListFestivals()` | Reads Supabase directly |

---

## 2. Which Tools Should Eventually Call Standalone BLUME

These tools implement BLUME logic in terravian-mcp and should be refactored to call BLUME:

| Tool | Migration Action |
|---|---|
| `blume_generate_post` | Call `generatePost()` from `@terravian/blume` |
| `blume_aida_sequence` | Call `generateAIDASequence()` from `@terravian/blume` |
| `blume_analyze_site` | Call `analyzeSiteForBrand()` from `@terravian/blume` |
| `blume_diagnose_switch` | Call `diagnoseBrand()` from `@terravian/blume` |
| `seo_generate` | Call `generateSEOContent()` from `@terravian/blume` |
| `blume_list_brands` | Call `listBrands()` from `@terravian/blume` |
| `blume_add_brand` | Call `addBrand()` + `initBrandVaults()` from `@terravian/blume` |
| `blume_remove_brand` | Call `removeBrand()` from `@terravian/blume` |
| `blume_init_vaults` | Call `initBrandVaults()` from `@terravian/blume` |
| `blume_vault_summary` | Call `getBrandVaultSummary()` from `@terravian/blume` |
| `blume_read_vault` | Call `readVault()` from `@terravian/blume` |
| `blume_log_to_vault` | Call `saveToVault()` from `@terravian/blume` |
| `vault_search` | Call `searchVaults()` from `@terravian/blume` |
| `blume_post` | Keep posting logic; call `generatePost()` from `@terravian/blume` for generation half |
| `festival_sync` | Keep task creation; BLUME pipeline functions already run as op queue handlers |

**Not yet in terravian-mcp but will be added via BLUME:**
- `blume_generate_offer` — exists in BLUME standalone, not yet in terravian-mcp
- `blume_generate_email` — exists in BLUME standalone, not yet in terravian-mcp

---

## 3. Which Tools Must Stay in terravian-mcp

These tools are terravian-mcp responsibilities and will never move to BLUME:

| Tool | Why it stays |
|---|---|
| `blume_post` | Calls STEALTHAPI gateway — posting stays in terravian-mcp |
| `blume_tweet` | Legacy posting — stays (will eventually be deprecated) |
| `blume_list_scheduled` | Scheduler queue — terravian-mcp owns |
| `blume_schedule_post` | Scheduler queue — terravian-mcp owns |
| `blume_bulk_schedule` | Scheduler queue — terravian-mcp owns |
| `blume_cancel_post` | Scheduler queue — terravian-mcp owns |
| `queue_list` | Scheduler queue read — terravian-mcp owns |
| `task_status` | Scheduler task — terravian-mcp owns |
| `task_retry` | Scheduler task — terravian-mcp owns |
| `op_task_create` | Op queue — terravian-mcp daemon owns |
| `op_task_list` | Op queue — terravian-mcp daemon owns |
| `op_task_status` | Op queue — terravian-mcp daemon owns |
| `op_task_retry` | Op queue — terravian-mcp daemon owns |
| `op_task_cancel` | Op queue — terravian-mcp daemon owns |
| `approval_respond` | Human-in-the-loop — terravian-mcp owns |
| `event_emit` | Event system — terravian-mcp owns routing |
| `event_list` | Event system — terravian-mcp owns |
| `event_subscribe` | Event subscription — terravian-mcp owns |
| `event_unsubscribe` | Event subscription — terravian-mcp owns |
| `event_subscriptions_list` | Event subscription — terravian-mcp owns |
| `system_health` | Stack-wide observability — terravian-mcp owns |
| `approval_queue` | Observability — terravian-mcp owns |
| `failure_feed` | Observability — terravian-mcp owns |
| `analytics_summary` | Cross-system aggregation — terravian-mcp owns |
| `workflow_run` | Workflow engine — terravian-mcp owns |
| `workflow_list` | Workflow engine — terravian-mcp owns |
| `workflow_status` | Workflow engine — terravian-mcp owns |
| `festival_list` | Reads Supabase directly — acceptable in either, simpler to keep here |

---

## 4. Which Tools Should Be Deprecated

| Tool | Reason | Replacement |
|---|---|---|
| `blume_tweet` | Twitter-only legacy wrapper around `blume_post` | Use `blume_post` with `platform: "twitter"` |

No other tools are candidates for deprecation at this stage. `blume_tweet` is the only redundant one.

---

## 5. Adapter Pattern Options

Four viable patterns for connecting terravian-mcp to BLUME logic. Each is described below with pros and cons.

### Option A: Import `@terravian/blume` Package

terravian-mcp adds `@terravian/blume` as a dependency (either via npm publish, npm link, or npm workspace) and imports BLUME functions directly.

```typescript
// Before (terravian-mcp)
import { generatePost } from "./agents/blume/index.js";

// After
import { generatePost } from "@terravian/blume";
```

**Pros:**
- Zero runtime overhead — same process, same memory
- Full TypeScript types across the boundary
- No extra processes, no network, no IPC
- Simplest refactor — swap import path, delete local copy
- Same error handling model — thrown errors propagate naturally
- Vault reads: local filesystem shared between both (same machine)
- Works with existing MCP server startup — no new processes

**Cons:**
- Requires BLUME to be published as an npm package or linked locally
- Version pinning: if BLUME API changes, terravian-mcp must update its import
- Single-process means a BLUME crash could affect terravian-mcp (low risk: BLUME is pure functions)
- npm link / workspace adds local development complexity

---

### Option B: MCP-to-MCP Call

terravian-mcp spawns the BLUME MCP server as a child process and sends JSON-RPC tool calls to it over stdio, exactly as Claude does.

```typescript
// terravian-mcp spawns BLUME and sends:
{ method: "tools/call", params: { name: "blume_generate_post", arguments: {...} } }
```

**Pros:**
- Complete process isolation — BLUME crashes don't affect terravian-mcp
- BLUME can be upgraded independently without touching terravian-mcp
- Clean protocol boundary: the exact same wire format Claude uses

**Cons:**
- Complex implementation: terravian-mcp must manage a child MCP process lifecycle
- Latency overhead: stdio IPC + JSON serialization for every call
- Subprocess management is fragile (startup timing, crash recovery, restart logic)
- No TypeScript types across the boundary — response is untyped JSON
- Error handling is indirect — must parse error responses from wire format
- Adds a second daemon to manage during terravian-mcp startup

---

### Option C: HTTP Local Service

BLUME runs as an HTTP API server on `localhost:PORT`. terravian-mcp makes `fetch()` calls to it.

```typescript
const response = await fetch("http://localhost:3001/generate-post", { ... });
```

**Pros:**
- Clean service boundary — BLUME is truly standalone
- Any language can call BLUME in the future
- Independent scaling and deployment possible
- BLUME can be restarted without touching terravian-mcp

**Cons:**
- Requires BLUME to implement and maintain an HTTP API server layer
- Network stack overhead for localhost calls (minimal but nonzero)
- Two processes must be running and healthy at all times
- Auth/security on localhost API is easy to overlook
- BLUME is not currently an HTTP server — significant new code to write
- Adds operational complexity: port management, process monitoring, restart policy
- Response types are untyped strings unless an OpenAPI spec is maintained

---

### Option D: Direct Shared Package (npm workspace / monorepo)

Both repos are restructured into a monorepo (`packages/blume`, `packages/terravian-mcp`). Shared packages are resolved by the workspace without publishing to npm.

```json
// workspace package.json
{ "workspaces": ["packages/*"] }
```

**Pros:**
- No publish step — changes in BLUME are immediately available in terravian-mcp
- Full TypeScript types and refactor tooling across both packages
- Single git repo simplifies coordination

**Cons:**
- Significant repo restructuring cost — both repos must be merged or linked
- Changes boundaries of two established projects simultaneously
- More complex CI/CD: one repo now manages two deployable units
- Not compatible with the current two-repo structure without a migration
- Adds monorepo tooling (Turborepo, pnpm workspaces, etc.) as a new dependency

---

## 6. Pros/Cons Summary Table

| Criterion | A: npm import | B: MCP-to-MCP | C: HTTP service | D: Monorepo |
|---|---|---|---|---|
| Implementation effort | Low | High | Very High | Very High |
| Operational complexity | Low | Medium | High | Medium |
| Type safety | Full | None | None (without OpenAPI) | Full |
| Process isolation | No | Yes | Yes | No |
| Latency overhead | Zero | High | Medium | Zero |
| Independent BLUME deploys | Requires version bump | Yes | Yes | No (shared repo) |
| Local dev complexity | Medium (npm link) | Low | Low | Medium |
| Production readiness | High | Low | Low | Low |

---

## 7. Recommended Safest First Migration

**Use Option A: Import `@terravian/blume` package via npm link.**

Rationale:

1. **Lowest risk** — it is a mechanical swap of import paths. The function signatures in BLUME standalone are intentionally compatible with the terravian-mcp versions.
2. **No runtime topology change** — no new processes, no new network calls, no new ports. terravian-mcp continues to start and run exactly as today.
3. **Zero latency cost** — all BLUME calls remain in-process. No serialization, no IPC.
4. **Full types** — TypeScript catches every mismatch at compile time before any runtime risk.
5. **Rollback is one line** — if the BLUME import fails, the old local import is still present. Swapping back takes 60 seconds.
6. **Vaults are local filesystem** — both terravian-mcp and BLUME read from the same `/vaults/` and `/brands/` directories on disk. There is no data migration required.

**Setup for npm link (local dev):**
```bash
# In BLUME repo
npm run build
npm link

# In terravian-mcp repo
npm link @terravian/blume
```

**Setup for production:**
```bash
# Publish BLUME to npm (or GitHub Packages)
npm publish

# In terravian-mcp
npm install @terravian/blume
```

---

## 8. Rollback Plan

Each migrated tool is independent. Rollback is per-tool, not all-or-nothing.

### Before any migration
- Tag the last pre-migration commit in terravian-mcp: `git tag pre-blume-migration`
- Confirm that both BLUME standalone and terravian-mcp MCP servers are passing smoke tests

### Per-tool rollback
- Every tool migration is a single import path change and possibly a function signature adjustment
- If a migrated tool fails in production: revert that tool's case block to the local import
- All other tools continue to work — migration failures are isolated to the tool under migration

### Full rollback
```bash
# In terravian-mcp
git revert HEAD  # or git reset --hard pre-blume-migration
npm install      # restore local deps
npm run build
```
- The BLUME standalone repo is unaffected — it has no runtime dependency on terravian-mcp
- Local `/vaults/` and `/brands/` directories are unchanged — no data impact

### Vault directory risk
The only shared mutable state is the local filesystem (`/vaults/`, `/brands/`). Both BLUME and terravian-mcp will read and write the same directories. This is by design and is already the current behavior. No vault data is at risk during migration.

---

## 9. Smoke Tests Required Before and After Migration

### Pre-migration smoke tests (baseline — run today)
These establish the baseline. Both servers must pass before any migration begins.

**terravian-mcp (existing behavior):**
- [ ] `blume_list_brands` returns the full brand list (26+ brands)
- [ ] `blume_generate_post` returns non-empty content for a known brand
- [ ] `blume_vault_summary` returns 8 vault entries for a known brand
- [ ] `seo_generate` returns SEO content with meta_title, meta_description, h1, intro
- [ ] `festival_list` returns festivals from Supabase (or empty if none)
- [ ] `system_health` returns without error
- [ ] `op_task_list` returns without error

**BLUME standalone (new server):**
- [ ] All 5 checks from `smoke-test.mjs` pass (already confirmed ✓)

### Post-migration smoke tests (run after each tool migration)

Run after each individual tool is migrated. The test must produce the same output as the pre-migration baseline for that tool.

**For each content generation tool:**
- [ ] Tool returns a result with the same shape as before migration
- [ ] No error fields in response
- [ ] Brand voice/mode is reflected in the output (not generic)
- [ ] Response time is within 2× of pre-migration baseline

**For brand registry tools:**
- [ ] `blume_list_brands` returns same count and same brand slugs
- [ ] `blume_add_brand` creates a JSON file in `/brands/` and initializes vaults
- [ ] `blume_remove_brand` removes the JSON file, vaults directory still exists

**For vault tools:**
- [ ] `blume_init_vaults` creates the expected directory structure
- [ ] `blume_log_to_vault` writes a file to the correct vault directory
- [ ] `blume_read_vault` returns entries written by `blume_log_to_vault`
- [ ] `vault_search` finds entries containing the search term

**Regression tests (run after all migrations complete):**
- [ ] All terravian-mcp non-BLUME tools still work (op_task_*, event_*, workflow_*, system_health, etc.)
- [ ] Festival pipeline still completes all 4 stages end-to-end
- [ ] Scheduled post daemon still fires at correct times
- [ ] No references to removed `agents/blume/` paths in terravian-mcp imports

---

## 10. Exact First Tool to Migrate

**Tool: `blume_list_brands`**

**Why this one first:**
- Pure read operation — no AI calls, no file writes, no network calls
- Idempotent — calling it 100 times has no side effect
- The safest possible test of the import adapter pattern
- If the import setup is wrong (wrong path, wrong types, wrong build), this tool will fail immediately with a clear error
- If it works, every other read-only tool follows the exact same pattern

**What the migration looks like (do not execute yet):**

```typescript
// terravian-mcp/src/server.ts — BEFORE
import {
  generatePost,
  generateAndTweet,
  generateAndPost,
  generateAIDASequence,
  analyzeAndRecommend,
  diagnoseBrand,
  initVaults,
  getVaultSummary,
  getBrands,          // ← remove this
  registerBrand,
  deregisterBrand,
} from "./agents/blume/index.js";

// terravian-mcp/src/server.ts — AFTER
import {
  generatePost,
  generateAndTweet,
  generateAndPost,
  generateAIDASequence,
  analyzeAndRecommend,
  diagnoseBrand,
  initVaults,
  getVaultSummary,
  registerBrand,
  deregisterBrand,
} from "./agents/blume/index.js";

import { listBrands } from "@terravian/blume"; // ← add this
```

```typescript
// Case block — BEFORE
case "blume_list_brands": {
  const brands = getBrands();
  return { content: [{ type: "text", text: JSON.stringify({ count: brands.length, brands }) }] };
}

// Case block — AFTER
case "blume_list_brands": {
  const brands = await listBrands();
  return { content: [{ type: "text", text: JSON.stringify({ count: brands.length, brands }) }] };
}
```

**Note:** `listBrands()` in BLUME standalone is `async`. `getBrands()` in terravian-mcp is synchronous. The `await` must be added. The return shape is the same.

**Smoke test to run after this migration (do not run yet):**
```bash
# In terravian-mcp
npm run build  # must compile clean
# Then verify blume_list_brands returns the same brand list as before
```

---

## Migration Order (After First Tool Validated)

Once `blume_list_brands` passes, proceed in this order — lowest risk first:

1. `blume_list_brands` ← first (planning only today)
2. `blume_vault_summary`
3. `blume_read_vault`
4. `vault_search`
5. `blume_init_vaults`
6. `blume_log_to_vault`
7. `blume_add_brand`
8. `blume_remove_brand`
9. `seo_generate`
10. `blume_diagnose_switch`
11. `blume_analyze_site`
12. `blume_aida_sequence`
13. `blume_generate_post`
14. `blume_post` (generation half only — posting stays)
15. Remove `src/agents/blume/` from terravian-mcp
16. Remove `src/festivals/types.ts` from terravian-mcp
17. Deprecate `blume_tweet` (add deprecation notice, point to `blume_post`)

**Do not begin any of these steps yet. This document is a plan only.**
