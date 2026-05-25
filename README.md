# BLUME Content + Listing Generator

**Public-signal-to-output engine for the Terravian empire.**

BLUME is the content and listing generation brain. It takes brand context, SEO signals, and structured data and turns them into blog content, social posts, SEO pages, event listings, and more.

---

## What BLUME Does (Phase 1)

| Capability | Status |
|---|---|
| Social post generation (6 platforms, AIDA, 6 modes) | Live |
| Full AIDA sequence generation | Live |
| Email + offer generation | Live |
| SEO content (meta title, description, H1, intro, social posts) | Live |
| Festival pipeline: ingest → dedup → SEO → publish | Live |
| 8-vault brand archive system | Live |
| Brand registry (26+ brands as JSON profiles) | Live |
| Site analysis + strategic recommendations | Live |
| 7 Sales Switches™ diagnosis | Live |
| Bulk content generation CLI | Live |
| MCP tools (standalone MCP server) | Live |
| Signal Intake Engine (SERP, Google Events, Maps, YouTube) | Phase 2 |
| Apartment / local page pipelines | Phase 2 |

---

## Architecture

```
src/
├── content/       # Generation engine: posts, SEO, emails, offers, analysis
├── brands/        # Brand registry: JSON profiles + registry CRUD
├── vault/         # 8-vault archive system (local + Supabase dual-write)
├── listings/
│   ├── festivals/ # FestivalCalendar.online pipeline (first vertical)
│   └── apartments/# Phase 2 stub
├── signals/       # Signal Intake Engine (Phase 2 stub)
├── integrations/  # AI (OpenAI/Anthropic), Supabase
├── mcp/           # Standalone MCP server
└── cli.ts         # Bulk generation + export CLI
```

See `docs/architecture.md` for full detail.

---

## Quick Start

```bash
# Install
npm install

# Set up environment
cp .env.example .env
# Fill in OPENAI_API_KEY or ANTHROPIC_API_KEY
# Fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (optional — local fallback if not set)

# Build
npm run build

# Run MCP server
npm run mcp

# CLI: init vaults for all brands
npm run cli -- init-vaults

# CLI: bulk generate content
npm run cli -- bulk-generate --posts 30 --offers 5 --emails 3

# CLI: export all vault data
npm run cli -- export-all
```

---

## Brands

26 brand profiles are registered in `/brands/*.json`. Each brand defines:
- Voice (archetype, tone, personality, do/don't, sample phrases)
- AIDA guidance (attention hook, interest, desire, action)
- Platforms

New brands can be added via the MCP tool `blume_add_brand` or by creating a JSON file directly.

---

## BLUME Modes

| Mode | Description |
|---|---|
| `collaborative` | Warm, partnership-focused, trust-building |
| `dominion_rex` | War mode — dominant, conquest-minded |
| `venus_protocol` | Alluring, magnetically compelling (sub-mode of dominion_rex) |
| `commerce` | Conversion-focused, deploys 7 Sales Switches |
| `insight` | Analytical, strategic, intelligence-led |
| `grace` | Nurturing, emotionally present, deeply human |

---

## Festival Pipeline (FestivalCalendar.online)

```
festival_sync (MCP)
    → festival_ingest  (Stage 1: normalize + insert to Supabase)
    → festival_dedup   (Stage 2: deduplicate, mark duplicates)
    → seo_page_generate (Stage 3: BLUME generates SEO content)
    → festival_publish  (Stage 4: set published + log to Vault 1)
```

Stages 2–4 run as op tasks queued in `thq_op_queue`, picked up by the daemon in `terravian-mcp`.

---

## Vault System (8 Vaults per Brand)

| Vault | Name | Purpose |
|---|---|---|
| 1 | Published Works | Released products, posts, pages |
| 2 | Proof of Use | Screenshots, URLs, first-use evidence |
| 3 | Commerce Evidence | Sales reports, receipts |
| 4 | Brand Assets | Logos, palettes, templates |
| 5 | Legal Disclaimers | Copyright, licensing, trademark |
| 6 | Creative Drafts | Unreleased content, brainstorms |
| 7 | Internal Notes | Strategy, confidential decisions |
| 8 | Investment Funding | Investor docs, traction reports |

---

## MCP Tools

Run `npm run mcp` to start the standalone BLUME MCP server. Available tools:

- `blume_generate_post` — Generate a social post
- `blume_aida_sequence` — Generate full 4-post AIDA sequence
- `blume_generate_offer` — Generate a promotional offer
- `blume_generate_email` — Generate an email (welcome/nurture/conversion)
- `blume_diagnose_switch` — Diagnose 7 Sales Switches™ bottleneck
- `blume_analyze_site` — Analyze a website for strategic opportunities
- `seo_generate` — Generate SEO content for a topic
- `blume_list_brands` / `blume_add_brand` / `blume_remove_brand`
- `blume_init_vaults` / `blume_vault_summary` / `blume_read_vault` / `blume_log_to_vault`
- `vault_search` — Full-text search across vaults
- `festival_sync` / `festival_list` — Festival pipeline

---

## Architectural Boundaries

These are locked. BLUME owns generation and storage. terravian-mcp owns execution and routing.

| Responsibility                        | Owner                                 |
| ------------------------------------- | ------------------------------------- |
| Content generation                    | **BLUME**                             |
| Listing generation                    | **BLUME**                             |
| Brand / site analysis                 | **BLUME**                             |
| Vault record storage                  | **BLUME**                             |
| Public signal ingestion               | **BLUME**                             |
| Multi-agent system orchestration      | **Terravian-MCP / TerravianHQ**       |
| Cross-system job scheduling           | **Terravian-MCP**                     |
| Social posting via OAuth / STEALTHAPI | **STEALTHAPI / Terravian-MCP bridge** |
| Final execution routing               | **Terravian-MCP / HQ**                |

See `docs/architecture.md` for the full boundary rules and "what this means in practice."

---

## Legal

Part of the Terravian empire. House of Terravian. All rights reserved.
