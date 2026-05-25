# BLUME Architecture

## Overview

BLUME is the content + listing generation engine for the Terravian empire. It is a standalone TypeScript project that:

1. Accepts brand context, topic signals, and structured data as input
2. Uses AI (OpenAI primary, Anthropic fallback) to generate content
3. Stores generated content in an 8-vault per-brand archive
4. Runs multi-stage listing pipelines (festival ingestion → dedup → SEO → publish)
5. Exposes all capabilities as MCP tools

BLUME does **not** post content to social platforms. It does **not** run the op queue daemon. Those responsibilities stay in `terravian-mcp`.

---

## Module Map

```
src/
│
├── content/                      BLUME Generation Engine
│   ├── persona.ts                BlumeMode types, BrandProfile usage, system prompts, PLATFORM_LIMITS
│   ├── generator.ts              generatePost, generateAIDASequence, generateOffer, generateEmail, diagnoseBrand
│   ├── seo.ts                    generateFestivalSEO, generateSEOContent
│   ├── analyzer.ts               scrapeSite, analyzeSiteForBrand
│   └── switches.ts               7 Sales Switches™ — SEVEN_SWITCHES, diagnoseSwitchFromContext
│
├── brands/                       Brand Registry
│   ├── types.ts                  BrandProfile interface
│   └── registry.ts               loadBrand, listBrands, addBrand, removeBrand (reads/writes /brands/*.json)
│
├── vault/                        8-Vault Brand Archive
│   ├── types.ts                  VaultNumber, VaultEntry, VAULT_NAMES, VAULT_DESCRIPTIONS
│   └── index.ts                  saveToVault, readVault, initBrandVaults, searchVaults, getBrandVaultSummary
│                                 Dual-write: local JSON (source of truth) + Supabase (async backup)
│
├── listings/                     Listing Generator
│   ├── types.ts                  VerticalType, ListingInput, ListingRecord
│   ├── festivals/                FestivalCalendar.online vertical (Phase 1 — complete)
│   │   ├── types.ts              FestivalInput, FestivalRecord, FestivalFilters
│   │   ├── seo.ts                Re-exports generateFestivalSEO
│   │   └── pipeline.ts           4-stage pipeline: ingest → dedup → seo_page_generate → publish
│   └── apartments/               Phase 2 stub
│       └── types.ts
│
├── signals/                      Signal Intake Engine (Phase 2)
│   ├── types.ts                  SignalInput, SignalResult, SourceType
│   └── index.ts                  Stub — ingestSignal(), listSignals()
│
├── integrations/
│   ├── ai.ts                     think() — OpenAI primary, Anthropic fallback
│   ├── openai.ts                 OpenAI chat client
│   ├── anthropic.ts              Anthropic messages client
│   └── supabase.ts               Supabase client — vault ops, festival ops, minimal task creation
│
├── mcp/
│   └── server.ts                 Standalone MCP server — all BLUME tools
│
├── cli.ts                        Bulk generation + export CLI
├── config.ts                     Environment config
└── index.ts                      Package exports
```

---

## Data Flow

### Social Post Generation

```
generatePost(req)
    → loadBrand(slug)           reads /brands/{slug}.json
    → getBlumeSystemPrompt()    builds mode + brand system prompt
    → think(system, user)       OpenAI / Anthropic
    → returns GeneratedPost     { content, brand, platform, mode, aidaStage, approved }
```

### Festival Pipeline

```
ingestFestivals(festivals[])
    → dbInsertFestivals()       insert to thq_festivals in Supabase
    → dbEmitEvent()             emit festival_ingested event
    → dbCreateTask(dedup)       create festival_dedup task in thq_op_queue
                                 ↓ (picked up by terravian-mcp daemon)
dedupFestivalBatch(batch_id)
    → dbFindDuplicate()         check for existing name+city
    → dbUpdateFestivalStatus()  mark duplicate or dedup_checked
    → dbCreateTask(seo_page_generate) per unique festival
                                 ↓ (picked up by terravian-mcp daemon)
generateFestivalPageSEO(festival_id)
    → dbGetFestivalById()
    → generateFestivalSEO()     BLUME insight mode → SEO content JSON
    → dbUpdateFestivalSEO()     save SEO content to Supabase
    → dbCreateTask(publish)
                                 ↓ (picked up by terravian-mcp daemon)
publishFestival(festival_id)
    → dbUpdateFestivalStatus("published")
    → saveToVault(brand, 1)     log to Vault 1 (Published Works)
    → dbEmitEvent(festival_published)
```

### Vault Writes

```
saveToVault(brand, vaultNumber, entry)
    → write {id}.json to /vaults/{brand}/vault-{N}-{name}/
    → dbSaveVaultEntry() fire-and-forget to Supabase thq_vault_entries
```

Local filesystem is always the source of truth. Supabase is a backup/sync layer.

---

## AI Layer

- **Primary**: OpenAI (`gpt-4o` / `gpt-4o-mini` for fast calls)
- **Fallback**: Anthropic (`claude-sonnet-4-6`)
- Auto-fallback: if OpenAI fails or key is missing, falls back to Anthropic

The `think(system, user, opts)` function is the single entry point for all AI calls.

---

## Database (Supabase)

BLUME uses the same Supabase project as `terravian-mcp`. Tables relevant to BLUME:

| Table | Owned by | Purpose |
|---|---|---|
| `thq_festivals` | BLUME | Festival records + pipeline status |
| `thq_vault_entries` | BLUME | Vault archive (backup to local files) |
| `thq_op_queue` | terravian-mcp | Op task queue — BLUME creates tasks, daemon executes them |
| `thq_events` | terravian-mcp | Event log — BLUME emits events, terravian-mcp routes subscriptions |

---

## Architectural Boundaries (Canonical)

These boundaries are locked. Any future feature must be assigned to an owner before implementation begins. When in doubt, BLUME owns generation and storage; terravian-mcp owns execution and routing.

See `docs/boundaries.md` for the full ownership spec: what each system owns, what is temporarily duplicated, what must be migrated, and what must never be duplicated again.

| Responsibility                          | Owner                                  |
| --------------------------------------- | -------------------------------------- |
| Content generation                      | **BLUME**                              |
| Listing generation                      | **BLUME**                              |
| Brand / site analysis                   | **BLUME**                              |
| Vault record storage                    | **BLUME**                              |
| Public signal ingestion                 | **BLUME**                              |
| Multi-agent system orchestration        | **Terravian-MCP / TerravianHQ**        |
| Cross-system job scheduling             | **Terravian-MCP**                      |
| Social posting via OAuth / STEALTHAPI   | **STEALTHAPI / Terravian-MCP bridge**  |
| Final execution routing                 | **Terravian-MCP / HQ**                 |

### What this means in practice

- BLUME **never** posts to social platforms directly.
- BLUME **never** runs the op queue daemon — it only creates tasks for the daemon to execute.
- BLUME **never** subscribes to events — it only emits them.
- BLUME **never** schedules jobs — it hands output to the queue and stops.
- Terravian-MCP **never** generates content, SEO copy, or vault entries — it delegates all generation to BLUME.

---

## Relationship with terravian-mcp

BLUME is the brain. terravian-mcp is the hands.

```
terravian-mcp
    ├── Scheduler daemon (thq_blume_queue)
    ├── Op queue daemon (thq_op_queue) — executes tasks BLUME creates
    ├── Event subscription router
    ├── Social posting (STEALTHAPI gateway + Twitter API)
    └── Observability (system_health, approval_queue, failure_feed)

blume (this repo)
    ├── Content generation engine
    ├── SEO generation
    ├── Signal ingestion (Phase 2)
    ├── Festival + listing pipelines (creates tasks, daemon executes)
    ├── Brand registry
    ├── Vault system
    └── Standalone MCP server
```

---

## Phase 2 Plans

1. **Signal Intake Engine** — `src/signals/` — SERP API, Google Events, Google Maps, YouTube, News ingestion
2. **Listing Generator expansion** — ApartmentEventCalendar, local pages, creator profiles
3. **terravian-mcp migration** — replace duplicated BLUME code in terravian-mcp with imports from this package
4. **Publishing Queue** — BLUME-owned queue for preparing content for approval/auto-publish
5. **Brand Router** — formal routing layer: signal → content type → brand voice → platform → queue
