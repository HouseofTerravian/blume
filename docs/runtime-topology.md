# Terravian Empire — Runtime Topology

**Date:** 2026-05-25
**Status:** Canonical — architecture freeze before Phase 2 tool migrations begin
**Purpose:** Freeze a complete picture of every runtime, its role, its relationships, and current migration state. This document does not define *what should be* — it defines *what is right now* and *what is planned*.

---

## The One-Sentence Principle

> BLUME generates. TerravianHQ orchestrates. STEALTHAPI posts. Supabase persists.

---

## 1. System Map (Top-Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE (Claude)                         │
│                    MCP client — issues tool calls                   │
└────────────────┬──────────────────────┬────────────────────────────┘
                 │                      │
        MCP stdio│                      │MCP stdio
                 ▼                      ▼
┌────────────────────────┐   ┌──────────────────────────┐
│    BLUME MCP Server    │   │  TerravianHQ MCP Server  │
│   (mcp__blume__)       │   │  (mcp__terravian-mcp__)  │
│                        │   │                          │
│  Generation engine     │   │  Orchestration spine     │
│  Brand registry        │   │  Op queue daemon         │
│  Vault system          │   │  Scheduler daemon        │
│  SEO + festival tools  │   │  Event router            │
│  Signal intake (ph2)   │   │  Social posting gateway  │
│                        │   │  Observability           │
└──────────┬─────────────┘   └────────────┬─────────────┘
           │                              │
           │  npm link (baby bridge)      │
           │◄─────────────────────────────┤
           │                              │
           │  Both read /brands/ + /vaults/ (shared local FS)
           │                              │
           └──────────┬───────────────────┘
                      │
                      ▼
         ┌────────────────────────┐       ┌─────────────────────┐
         │       Supabase         │       │     STEALTHAPI      │
         │  Persistence layer     │       │  Posting gateway    │
         │                        │       │                     │
         │  thq_festivals         │       │  Twitter/X          │
         │  thq_vault_entries     │       │  Instagram          │
         │  thq_op_queue          │       │  LinkedIn           │
         │  thq_events            │       │  Facebook           │
         │  thq_blume_queue       │       │  TikTok             │
         │  thq_event_subscriptions│      │  YouTube            │
         └────────────────────────┘       └─────────────────────┘
```

---

## 2. TerravianHQ Runtime Role

TerravianHQ is the empire's **orchestration spine**. It is the runtime that knows what to do with BLUME output — when to post it, how to queue it, how to route events, and how to report on system health.

**Repo:** `HouseofTerravian/terravian-mcp`
**Local:** `C:/dev/active/terravian-mcp`
**MCP server name (in Claude):** `mcp__terravian-mcp__`

### What TerravianHQ owns at runtime

| Responsibility | Detail |
|---|---|
| **Op queue daemon** | Polls `thq_op_queue`, dispatches tasks, handles retries and failures |
| **Scheduler daemon** | Polls `thq_blume_queue`, fires timed post jobs |
| **Event router** | Reads `thq_event_subscriptions`, routes events to correct task handlers |
| **Social posting** | Bridges finalized content to STEALTHAPI or Twitter API directly |
| **Approval queue** | Human-in-the-loop gate before posting |
| **Observability** | `system_health`, `failure_feed`, `analytics_summary` |
| **Workflow engine** | Multi-step, cross-system workflow execution |
| **Festival task creation** | Creates op tasks that trigger BLUME pipeline stages |

### What TerravianHQ does NOT do

- Generate content, SEO copy, or vault entries
- Implement generation logic (even temporarily)
- Post to social platforms directly without going through STEALTHAPI gateway
- Subscribe to events (it manages subscriptions, not consumes them the same way)

### Internal structure

```
terravian-mcp/
├── src/
│   ├── server.ts             MCP tool definitions (42 tools)
│   ├── agents/blume/         DUPLICATE of BLUME logic — being removed in Phase 2
│   │   ├── index.ts          generatePost, getBrands, initVaults, getVaultSummary, ...
│   │   ├── persona.ts        BlumeMode, system prompts
│   │   ├── seo.ts            generateSEOContent
│   │   ├── switches.ts       7 Sales Switches™
│   │   └── vault.ts          saveToVault, readVault, searchVaults
│   ├── adapters/
│   │   └── blume.ts          ← Baby bridge: blumeListBrandsAdapter() [ACTIVE]
│   ├── queue/                Op queue daemon + handlers
│   ├── events/               Event subscription router
│   ├── workflows/            Workflow runner
│   ├── observability/        Health, failures, analytics
│   └── tools/
│       ├── scheduler/        Post scheduling daemon
│       └── social/           STEALTHAPI gateway + Twitter API
```

---

## 3. BLUME Runtime Role

BLUME is the empire's **generation engine**. It is the only system that knows how to generate content, analyze brands, build SEO copy, run listing pipelines, and write vault entries. Every piece of content in the empire originates here.

**Repo:** `HouseofTerravian/blume`
**Local:** `C:/dev/active/blume`
**MCP server name (in Claude):** `mcp__blume__`
**npm package name:** `@terravian/blume`

### What BLUME owns at runtime

| Responsibility | Detail |
|---|---|
| **Content generation** | Social posts (all platforms + modes), AIDA sequences, offers, emails |
| **Brand intelligence** | BrandProfile schema, brand registry CRUD, 7 Sales Switches™ diagnosis |
| **Site analysis** | Web scraping + strategic brand recommendations |
| **Vault system** | 8 vaults per brand — local filesystem (source of truth) + Supabase async backup |
| **SEO generation** | Meta title, description, H1, intro, social posts — per page |
| **Festival pipeline** | Pure functions: ingest → dedup → seo_page_generate → publish |
| **Signal intake** | Phase 2: SERP, Google Events, Google Maps, YouTube, News (stubs exist) |
| **Standalone MCP server** | All BLUME tools available to Claude directly via `mcp__blume__` |

### What BLUME does NOT do

- Post to any social platform
- Run any daemon or polling loop
- Subscribe to events (emits only)
- Write to the scheduler queue (`thq_blume_queue`)
- Manage scheduling logic

### Internal structure

```
blume/
├── src/
│   ├── content/
│   │   ├── generator.ts      generatePost, generateAIDASequence, generateOffer, generateEmail
│   │   ├── persona.ts        BlumeMode, BrandProfile, PLATFORM_LIMITS, system prompts
│   │   ├── seo.ts            generateSEOContent, generateFestivalSEO
│   │   ├── analyzer.ts       scrapeSite, analyzeSiteForBrand
│   │   └── switches.ts       SEVEN_SWITCHES, diagnoseSwitchFromContext
│   ├── brands/
│   │   ├── types.ts          BrandProfile interface (canonical)
│   │   └── registry.ts       loadBrand, listBrands, addBrand, removeBrand
│   ├── vault/
│   │   ├── types.ts          VaultNumber, VaultEntry, VAULT_NAMES (canonical)
│   │   └── index.ts          saveToVault, readVault, initBrandVaults, searchVaults, getBrandVaultSummary
│   ├── listings/
│   │   └── festivals/        Festival pipeline (ingest, dedup, seo_page_generate, publish)
│   ├── signals/              Phase 2 stub — ingestSignal(), listSignals()
│   ├── integrations/
│   │   ├── ai.ts             think() — OpenAI primary, Anthropic fallback
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── supabase.ts       Vault + festival ops + minimal task creation only
│   └── mcp/
│       └── server.ts         Standalone MCP server
├── brands/                   26 brand JSON files (source of truth)
├── vaults/                   Per-brand vault directories (local source of truth)
├── smoke-test.mjs            5-check runtime verification
└── CLAUDE.md
```

### AI layer

```
think(system, user, opts)
     │
     ├── Primary:  OpenAI gpt-4o / gpt-4o-mini
     └── Fallback: Anthropic claude-sonnet-4-6
         (auto-switches if OpenAI key missing or call fails)
```

---

## 4. STEALTHAPI Runtime Role

STEALTHAPI is the empire's **social delivery gateway**. It is a runtime service — not a repo with business logic — responsible only for the final step of content delivery.

**Runtime type:** External HTTP service
**Called by:** TerravianHQ (`terravian-mcp/src/tools/social/`)

### What STEALTHAPI owns

| Responsibility | Detail |
|---|---|
| **OAuth token management** | Long-lived platform credentials for all social accounts |
| **Platform rate limiting** | Respects per-platform rate windows and queueing |
| **Media upload** | Image and video upload handling before post submission |
| **Post submission** | Twitter/X, Instagram, LinkedIn, Facebook, TikTok, YouTube |
| **Delivery confirmation** | Post status and platform-assigned post IDs |

### What STEALTHAPI does NOT do

- Generate content
- Know about brands, vaults, or SEO
- Interact with Supabase directly

---

## 5. Supabase Runtime Role

Supabase is the empire's **persistence layer**. It owns durable state. It does not own logic — every table is written to and read from by the system that owns that table's domain.

**Project:** Shared — same Supabase project across BLUME and TerravianHQ

### Table ownership map

```
┌────────────────────────────┬──────────────────┬──────────────────────────────────────────────┐
│ Table                      │ Primary owner    │ Access pattern                               │
├────────────────────────────┼──────────────────┼──────────────────────────────────────────────┤
│ thq_festivals              │ BLUME            │ BLUME writes full records; HQ reads for tasks│
│ thq_vault_entries          │ BLUME            │ BLUME writes async backup; local FS is truth │
│ thq_op_queue               │ TerravianHQ      │ BLUME creates tasks; HQ daemon executes      │
│ thq_op_queue_events        │ TerravianHQ      │ Internal to HQ daemon — BLUME does not write │
│ thq_events                 │ TerravianHQ      │ BLUME emits; HQ routes subscriptions         │
│ thq_event_subscriptions    │ TerravianHQ      │ HQ manages; BLUME never writes here          │
│ thq_blume_queue            │ TerravianHQ      │ Scheduler queue — BLUME never writes here    │
└────────────────────────────┴──────────────────┴──────────────────────────────────────────────┘
```

**Critical rule:** Local `/vaults/` and `/brands/` directories are always the source of truth. Supabase vault records are an async fire-and-forget backup. Any read that requires accuracy reads local filesystem first.

---

## 6. MCP Server Relationships

Two MCP servers run in parallel during Phase 2 migration. Both are registered in `~/.claude.json`.

```
~/.claude.json
├── blume          →  C:/dev/active/blume/src/mcp/server.ts    (BLUME standalone)
└── terravian-mcp  →  C:/dev/active/terravian-mcp/dist/server.js  (TerravianHQ)
```

### Tool namespace separation

```
mcp__blume__*              All BLUME-owned generation, vault, brand, SEO, festival tools
mcp__terravian-mcp__*      All orchestration, op queue, scheduling, event, social, observability tools
```

### Tool overlap (currently duplicated — intentional, temporary)

These tools exist in both MCP namespaces during migration. The terravian-mcp versions are being progressively refactored to call BLUME internally rather than implementing the logic themselves.

```
Tool                      mcp__blume__         mcp__terravian-mcp__       Bridge state
─────────────────────────────────────────────────────────────────────────────────────
blume_list_brands         ✅ native            ✅ → via adapter            BRIDGED (baby bridge active)
blume_vault_summary       ✅ native            ⏳ local copy              PENDING (tool #2)
blume_read_vault          ✅ native            ⏳ local copy              PENDING (tool #3)
vault_search              ✅ native            ⏳ local copy              PENDING (tool #4)
blume_init_vaults         ✅ native            ⏳ local copy              PENDING (tool #5)
blume_log_to_vault        ✅ native            ⏳ local copy              PENDING (tool #6)
blume_add_brand           ✅ native            ⏳ local copy              PENDING (tool #7)
blume_remove_brand        ✅ native            ⏳ local copy              PENDING (tool #8)
seo_generate              ✅ native            ⏳ local copy              PENDING (tool #9)
blume_diagnose_switch     ✅ native            ⏳ local copy              PENDING (tool #10)
blume_analyze_site        ✅ native            ⏳ local copy              PENDING (tool #11)
blume_aida_sequence       ✅ native            ⏳ local copy              PENDING (tool #12)
blume_generate_post       ✅ native            ⏳ local copy              PENDING (tool #13)
blume_post                n/a (BLUME doesn't post) ✅ stays here          NOT MIGRATING (posting stays)
```

---

## 7. Adapter Relationships (Baby Bridge)

The baby bridge is the mechanism by which TerravianHQ tools call BLUME instead of their local duplicate — one tool at a time, in order, with full verification between each migration.

### Current adapter state

```
terravian-mcp/src/adapters/blume.ts
    │
    │  exports: blumeListBrandsAdapter()
    │
    └── imports: listBrands from @terravian/blume
                        │
                        └── resolves via npm link:
                            terravian-mcp/node_modules/@terravian/blume
                                → symlink →
                            C:/dev/active/blume/dist/index.js
```

### How the adapter is called

```
Claude calls: mcp__terravian-mcp__blume_list_brands
      │
      ▼
terravian-mcp/dist/server.js
  case "blume_list_brands":
      │
      ▼
  blumeListBrandsAdapter()          ← adapters/blume.ts
      │
      ▼
  listBrands()                      ← @terravian/blume → blume/dist/index.js
      │
      ▼
  reads /brands/*.json on local FS
      │
      ▼
  returns { count: 26, brands: [...] }
      │
      ▼
Claude receives: { count: 26, brands: [...] }
```

### Adapter pattern (canonical — applies to all future bridges)

```typescript
// terravian-mcp/src/adapters/blume.ts
import { listBrands } from "@terravian/blume";

export async function blumeListBrandsAdapter() {
  const brands = await listBrands();
  return { count: brands.length, brands };
}
```

---

## 8. Current Migration State

**Phase 1:** Complete — BLUME standalone is live with all generation, vault, brand, festival, and SEO tools.

**Phase 2:** In progress — migrating terravian-mcp BLUME tools to call `@terravian/blume` via adapter pattern.

```
Migration order and status:

 #   Tool                   Status     Notes
─────────────────────────────────────────────────────────────────
 1   blume_list_brands      ✅ DONE    Baby bridge confirmed live (both servers: 26 brands)
 2   blume_vault_summary    ⬜ NEXT    Gate G1–G10 confirmed — cleared to begin
 3   blume_read_vault       ⬜
 4   vault_search           ⬜
 5   blume_init_vaults      ⬜
 6   blume_log_to_vault     ⬜
 7   blume_add_brand        ⬜
 8   blume_remove_brand     ⬜
 9   seo_generate           ⬜
10   blume_diagnose_switch  ⬜
11   blume_analyze_site     ⬜
12   blume_aida_sequence    ⬜
13   blume_generate_post    ⬜
14   blume_post (gen half)  ⬜         Posting logic stays in terravian-mcp
15   Remove agents/blume/   ⬜         Only after all above tools migrated
16   Remove festivals/types ⬜         Only after all above tools migrated
17   Deprecate blume_tweet  ⬜         Add deprecation notice, point to blume_post
```

**Not migrating (stays in TerravianHQ forever):**
- All scheduling tools (`blume_list_scheduled`, `blume_schedule_post`, `blume_bulk_schedule`, `blume_cancel_post`)
- All op queue tools (`op_task_*`)
- All event tools (`event_*`)
- All observability tools (`system_health`, `approval_queue`, `failure_feed`, `analytics_summary`)
- All workflow tools (`workflow_*`)
- `blume_post` posting logic (generation half migrates; STEALTHAPI call stays)
- `festival_list` (reads Supabase directly — acceptable to keep in terravian-mcp)

---

## 9. Current Baby Bridge State

```
Active bridges:     1 of 17 (blume_list_brands)
npm link status:    ACTIVE — C:/dev/active/blume/dist/index.js
Build status:       Both servers clean
Verification gates: G1–G10 all confirmed ✅
Next tool:          blume_vault_summary

npm link health check:
  C:/dev/active/terravian-mcp/node_modules/@terravian/blume/dist/index.js
  Must exist. If missing, re-run:
    cd C:/dev/active/blume && npm run build && npm link
    cd C:/dev/active/terravian-mcp && npm link @terravian/blume
```

**npm link risk note:** npm link is a local development symlink, not a real install. Running `npm install` in terravian-mcp may break the link. If deploying to production before `@terravian/blume` is published, use one of:
- `"@terravian/blume": "github:HouseofTerravian/blume#main"` in package.json
- `npm publish` + `npm install @terravian/blume`

---

## 10. Command Flow Examples

### 10a. Direct generation command (Claude → BLUME)

```
User: "Generate a post for crownstrike"

Claude calls: mcp__blume__blume_generate_post
  { brand: "crownstrike", platform: "instagram", mode: "dominion_rex" }
            │
            ▼
BLUME: generatePost(req)
  → loadBrand("crownstrike")          reads /brands/crownstrike.json
  → getBlumeSystemPrompt(mode, brand) builds dominion_rex system prompt with brand voice
  → think(system, user)               OpenAI gpt-4o (or Anthropic fallback)
  → returns GeneratedPost { content, brand, platform, mode, aidaStage, approved: false }
            │
            ▼
Claude returns: generated post content
```

### 10b. Brand list command (bridged — Claude → TerravianHQ → BLUME)

```
User: "List all brands"

Claude calls: mcp__terravian-mcp__blume_list_brands
            │
            ▼
TerravianHQ server.ts
  case "blume_list_brands":
    await blumeListBrandsAdapter()
            │
            ▼
  @terravian/blume → listBrands()
    reads /brands/*.json (local FS)
            │
            ▼
Claude returns: { count: 26, brands: [...] }

Same result available directly via:
  mcp__blume__blume_list_brands  →  { count: 26, brands: [...] }
```

### 10c. Observability command (Claude → TerravianHQ only)

```
User: "What's the system health?"

Claude calls: mcp__terravian-mcp__system_health
            │
            ▼
TerravianHQ server.ts
  case "system_health":
    getSystemHealth()
      → Supabase: query thq_op_queue (pending/failed tasks)
      → Supabase: query thq_events (recent events)
      → Supabase: query thq_blume_queue (scheduled posts)
      → Returns stack-wide health summary
            │
            ▼
Claude returns: { queues: {...}, events: {...}, health: "ok" }

BLUME has no system_health tool. This command does not touch BLUME.
```

---

## 11. Generation Flow Examples

### 11a. AIDA sequence generation

```
Claude calls: mcp__blume__blume_aida_sequence
  { brand: "winthehour", topic: "crushing your first hour" }
            │
            ▼
BLUME: generateAIDASequence(req)
  → loadBrand("winthehour")
  → builds 4 stage prompts: Attention → Interest → Desire → Action
  → think() × 4  (each stage is a separate AI call)
  → returns AIDASeries { posts: [Post×4], brand, topic }
            │
            ▼
Vault write (optional — if logged):
  saveToVault("winthehour", 3, entry)        Vault 3: Content Queue
    → writes {id}.json to /vaults/winthehour/vault-3-content-queue/
    → fire-and-forget: dbSaveVaultEntry() to Supabase thq_vault_entries
```

### 11b. Festival SEO generation (multi-stage pipeline)

```
Stage 1 — Ingest:
  Claude calls: mcp__blume__festival_sync (or terravian-mcp)
    ingestFestivals([...])
      → dbInsertFestivals()         writes to thq_festivals in Supabase
      → dbEmitEvent(festival_ingested)
      → dbCreateTask("festival_dedup", { batch_id })
                                    ↓ task sits in thq_op_queue

Stage 2 — Dedup (daemon picks up task):
  TerravianHQ op queue daemon
    → dispatches festival_dedup handler
    → calls BLUME: dedupFestivalBatch({ batch_id })
      → dbFindDuplicate()           checks name+city in thq_festivals
      → dbUpdateFestivalStatus()    marks duplicate | dedup_checked
      → dbCreateTask("festival_seo_page_generate", per unique festival)
                                    ↓ task sits in thq_op_queue

Stage 3 — SEO generation (daemon picks up task):
  TerravianHQ op queue daemon
    → dispatches festival_seo_page_generate handler
    → calls BLUME: generateFestivalPageSEO({ festival_id })
      → dbGetFestivalById()
      → generateFestivalSEO()       think() → structured SEO JSON
      → dbUpdateFestivalSEO()       saves to thq_festivals
      → dbCreateTask("festival_publish")
                                    ↓ task sits in thq_op_queue

Stage 4 — Publish (daemon picks up task):
  TerravianHQ op queue daemon
    → dispatches festival_publish handler
    → calls BLUME: publishFestival({ festival_id })
      → dbUpdateFestivalStatus("published")
      → saveToVault(brand, 1)       Vault 1: Published Works
      → dbEmitEvent(festival_published)
```

---

## 12. Posting Flow Examples

### 12a. Manual post + immediate publish

```
User: "Post to Instagram for crownstrike: [copy]"

Claude calls: mcp__terravian-mcp__blume_post
  { brand: "crownstrike", platform: "instagram", content: "[copy]" }
            │
            ▼
TerravianHQ server.ts
  case "blume_post":
    generateAndPost(req)
      │
      ├── [Generation half — currently local, will call BLUME in Phase 2]
      │     generatePost(req)        agents/blume/index.ts (temporary local copy)
      │
      └── [Posting half — stays in TerravianHQ forever]
            STEALTHAPI gateway call
              → POST https://stealthapi.io/post
                { platform: "instagram", content, account_id }
              → returns { post_id, status: "published" }
            │
            ▼
      saveToVault(brand, 1)          Vault 1: Published Works (async)
            │
            ▼
Claude returns: { post_id, platform, status: "published" }
```

### 12b. Scheduled post flow

```
User: "Schedule a post for winthehour tomorrow at 9am"

Claude calls: mcp__terravian-mcp__blume_schedule_post
  { brand: "winthehour", platform: "twitter", content: "...", scheduled_at: "2026-05-26T09:00:00" }
            │
            ▼
TerravianHQ: schedulePost()
  → dbInsertScheduledPost()          writes to thq_blume_queue in Supabase
  → returns { scheduled_id, scheduled_at }
            │
            ▼  (at scheduled_at time)
TerravianHQ scheduler daemon
  → reads thq_blume_queue (polling)
  → fires: generateAndPost(queued entry)
      → [same flow as 12a above]
```

### 12c. Full generate → approve → post flow (human-in-the-loop)

```
User: "Generate a post for sagaofpolarity, queue for approval"

Step 1 — Generate:
  Claude calls: mcp__blume__blume_generate_post
    → returns GeneratedPost { content, approved: false }

Step 2 — Queue for approval:
  Claude calls: mcp__terravian-mcp__op_task_create
    { type: "post_approval", payload: { content, brand, platform } }
    → dbCreateTask()                 writes to thq_op_queue
    → dbEmitEvent("post_queued_for_approval")
    → returns { task_id }

Step 3 — Human reviews:
  Claude calls: mcp__terravian-mcp__approval_queue
    → returns pending approval tasks
  User: "Approve task abc123"
  Claude calls: mcp__terravian-mcp__approval_respond
    { task_id: "abc123", decision: "approve" }
    → dbUpdateTask(approved)
    → dbCreateTask("post_publish", { content, brand, platform })

Step 4 — Daemon posts:
  TerravianHQ daemon picks up post_publish task
    → calls STEALTHAPI gateway
    → saveToVault(brand, 1)
    → dbEmitEvent("post_published")
```

---

## 13. Future Multi-Model Orchestration (High-Level Concept)

This is a directional concept only. No code changes planned yet.

### Vision

As BLUME matures, it will support routing different content tasks to different AI models based on task type, cost, latency requirements, and brand sensitivity. TerravianHQ will direct traffic; BLUME will execute.

```
TerravianHQ
  → receives generation request
  → inspects: brand, content type, mode, urgency flag
  → routes to BLUME with model hint:
      { model_preference: "fast" | "quality" | "cheap" | "balanced" }
            │
            ▼
BLUME: think(system, user, { model_preference })
  ├── "fast"     → gpt-4o-mini  (low-latency, low-cost)
  ├── "quality"  → gpt-4o       (default)
  ├── "balanced" → claude-sonnet-4-6 (Anthropic fallback or primary for certain brands)
  └── "cheap"    → gpt-4o-mini  (batch, non-urgent)
```

### Planned multi-model expansion

```
┌─────────────────────────────────────────────────────────────────┐
│                     TerravianHQ Orchestrator                    │
│                                                                 │
│  Signal in → Brand Router → Content Type → Model Selector      │
│                                    │                            │
└────────────────────────────────────┼────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                       ▼
        ┌──────────┐          ┌──────────┐           ┌──────────────┐
        │ OpenAI   │          │Anthropic │           │  Future      │
        │ gpt-4o   │          │ Sonnet   │           │  Models      │
        │ gpt-4o-  │          │  4.6+    │           │  (Gemini,    │
        │   mini   │          │          │           │   etc.)      │
        └──────────┘          └──────────┘           └──────────────┘
              │                      │                       │
              └──────────────────────┴───────────────────────┘
                                     │
                              BLUME think()
                          (unified output format)
                                     │
                              Vault + Queue
```

### Brand Router concept (Phase 3+)

```
Signal arrives (SERP / social trend / manual) for brand "forbiddengnosis"
    │
    ▼
Brand Router
  → loads BrandProfile("forbiddengnosis")
  → evaluates: signal type, vertical, platform targets
  → selects: content_type = "long_form_post", mode = "insight"
  → selects: model = "quality" (Forbidden Gnosis uses dense, philosophical voice)
  → selects: platforms = ["instagram", "twitter"]
  → dispatches to BLUME with full context
    │
    ▼
BLUME generates 2 platform-optimized variants
  → returns GeneratedPost × 2
    │
    ▼
TerravianHQ queues for approval (if brand requires) or schedules directly
```

### What will NOT change

- BLUME never posts. TerravianHQ always owns the posting decision.
- Supabase always holds the durable queue state.
- Local `/vaults/` always holds the source-of-truth vault.
- The brand boundary (26 brands → `@terravian/blume`) remains the canonical registry.

---

## 14. Quick Reference: Who Owns What

```
Action                                 Owner
─────────────────────────────────────────────────────────
Generate a social post                 BLUME
Generate an AIDA sequence              BLUME
Generate SEO copy                      BLUME
Analyze a brand's website              BLUME
Diagnose 7 Sales Switches™             BLUME
Write to a brand vault                 BLUME
Search vault entries                   BLUME
Add / remove a brand                   BLUME
Run a festival pipeline stage          BLUME
Ingest a signal (Phase 2)              BLUME

Post content to Instagram/Twitter/etc  STEALTHAPI (via TerravianHQ)
Schedule a post for later              TerravianHQ (thq_blume_queue)
Retry a failed op task                 TerravianHQ (daemon)
Route an event to a handler            TerravianHQ (event router)
Check system health                    TerravianHQ
View the approval queue                TerravianHQ
Run a multi-step workflow              TerravianHQ

Persist festival records               Supabase (thq_festivals)
Persist vault entries (backup)         Supabase (thq_vault_entries)
Hold the op queue                      Supabase (thq_op_queue)
Hold the scheduler queue               Supabase (thq_blume_queue)
Hold event log                         Supabase (thq_events)

Deliver content to platform API        STEALTHAPI
Manage OAuth tokens for platforms      STEALTHAPI
Handle platform rate limits            STEALTHAPI
```

---

*Architecture frozen as of 2026-05-25. Do not begin tool #2 migration (`blume_vault_summary`) before this document is committed and pushed.*
