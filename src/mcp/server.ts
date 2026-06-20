/**
 * BLUME MCP Server — standalone
 * Exposes BLUME's content + listing generation as MCP tools.
 *
 * Phase 1: generation, SEO, vaults, brands, festival pipeline.
 * Posting, scheduling, and daemon tools remain in terravian-mcp.
 */

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config.js";

import { generatePost, generateAIDASequence, generateOffer, generateEmail, diagnoseBrand } from "../content/generator.js";
import { generateSEOContent } from "../content/seo.js";
import { analyzeSiteForBrand } from "../content/analyzer.js";
import { listBrands, loadBrand, addBrand, removeBrand } from "../brands/registry.js";
import {
  initBrandVaults,
  getBrandVaultSummary,
  readVault,
  saveToVault,
  searchVaults,
} from "../vault/index.js";
import { ingestFestivals } from "../listings/festivals/pipeline.js";
import { dbListFestivals } from "../integrations/supabase.js";
import type { PostRequest } from "../content/persona.js";
import type { VaultNumber } from "../vault/types.js";
import type { BrandProfile } from "../brands/types.js";
import type { FestivalInput, FestivalCategory, FestivalStatus } from "../listings/festivals/types.js";
import { ingestArtifact, getArtifact, listArtifacts } from "../artifacts/store.js";
import { validateRouterTag } from "../artifacts/routerTag.js";
import { listVaultRegistry } from "../artifacts/registry.js";
import { migrateLegacyVaultEntries } from "../artifacts/migrate.js";
import type { ArtifactSource, RouterTag } from "../artifacts/types.js";
import { computeReadiness, getLotusConfig, detectBottleneck, detectMissingEvidence } from "../lotus/engine.js";

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "blume_generate_post",
    description: "BLUME generates a social media post for a brand. Supports all platforms, AIDA stages, and BLUME modes.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string", description: "Brand slug" },
        platform: { type: "string", enum: ["twitter", "instagram", "linkedin", "facebook", "tiktok", "youtube"] },
        goal: { type: "string", enum: ["awareness", "engagement", "conversion", "retention", "launch"] },
        aida_stage: { type: "string", enum: ["attention", "interest", "desire", "action"] },
        mode: { type: "string", enum: ["collaborative", "commerce", "insight", "grace"], description: "Public voice. Default = collaborative (calm-premium)." },
        topic: { type: "string" },
        human_loop: { type: "boolean", description: "If true, returns draft for approval. Default: true" },
      },
      required: ["brand", "platform", "goal"],
    },
  },
  {
    name: "blume_aida_sequence",
    description: "BLUME generates a full 4-post AIDA sequence (Attention → Interest → Desire → Action) for a brand on a platform.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        platform: { type: "string", enum: ["twitter", "instagram", "linkedin", "facebook", "tiktok", "youtube"] },
        goal: { type: "string", enum: ["awareness", "engagement", "conversion", "retention", "launch"] },
        mode: { type: "string", enum: ["collaborative", "commerce", "insight", "grace"], description: "Public voice. Default = collaborative (calm-premium)." },
        topic: { type: "string" },
      },
      required: ["brand", "platform", "goal"],
    },
  },
  {
    name: "blume_generate_offer",
    description: "BLUME generates a promotional offer for a brand in Commerce Mode.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        offer_number: { type: "number", description: "Offer sequence number. Default: 1" },
      },
      required: ["brand"],
    },
  },
  {
    name: "blume_generate_email",
    description: "BLUME generates a brand email (welcome, nurture, or conversion) for an automated sequence.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        sequence_type: { type: "string", enum: ["welcome", "nurture", "conversion"], description: "Email sequence type" },
      },
      required: ["brand", "sequence_type"],
    },
  },
  {
    name: "blume_diagnose_switch",
    description: "BLUME diagnoses which of the 7 Sales Switches™ a brand is stuck at, and provides actionable advice.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        context: { type: "string", description: "Describe the brand's current situation or challenge" },
      },
      required: ["brand", "context"],
    },
  },
  {
    name: "blume_analyze_site",
    description: "BLUME scrapes and analyzes a URL, returning strategic growth opportunities and suggested posts.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        brand: { type: "string" },
      },
      required: ["url", "brand"],
    },
  },
  {
    name: "seo_generate",
    description: "Generate SEO content: meta title, meta description, H1, 150-word intro, and 3 social posts.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        topic: { type: "string" },
        url: { type: "string" },
      },
      required: ["brand", "topic"],
    },
  },
  {
    name: "blume_list_brands",
    description: "Lists all brand slugs registered in BLUME.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "blume_add_brand",
    description: "Register a new brand in BLUME. Creates the brand profile JSON and initializes 8 vaults.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        name: { type: "string" },
        domain: { type: "string" },
        tagline: { type: "string" },
        entity: { type: "string" },
        voice_archetype: { type: "string" },
        voice_tone: { type: "string" },
        voice_personality: { type: "string" },
        voice_do: { type: "array", items: { type: "string" } },
        voice_dont: { type: "array", items: { type: "string" } },
        sample_phrases: { type: "array", items: { type: "string" } },
        platforms: { type: "array", items: { type: "string", enum: ["twitter", "instagram", "linkedin", "facebook", "tiktok", "youtube"] } },
        aida_attention: { type: "string" },
        aida_interest: { type: "string" },
        aida_desire: { type: "string" },
        aida_action: { type: "string" },
      },
      required: ["slug", "name", "domain", "tagline"],
    },
  },
  {
    name: "blume_remove_brand",
    description: "Remove a brand from BLUME. Vaults are preserved.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "blume_init_vaults",
    description: "Initialize all 8 vaults for a brand.",
    inputSchema: {
      type: "object",
      properties: { brand: { type: "string" } },
      required: ["brand"],
    },
  },
  {
    name: "blume_vault_summary",
    description: "Returns a count of entries in each of the 8 vaults for a brand.",
    inputSchema: {
      type: "object",
      properties: { brand: { type: "string" } },
      required: ["brand"],
    },
  },
  {
    name: "blume_read_vault",
    description: "Read entries from a specific vault (1–8) for a brand.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        vault: { type: "number", minimum: 1, maximum: 8 },
        limit: { type: "number" },
      },
      required: ["brand", "vault"],
    },
  },
  {
    name: "blume_log_to_vault",
    description: "Manually log an entry into a specific vault.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        vault: { type: "number", minimum: 1, maximum: 8 },
        title: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["brand", "vault", "title", "content"],
    },
  },
  {
    name: "vault_search",
    description: "Full-text search across all vault entries for a brand.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        query: { type: "string" },
        vault: { type: "number", minimum: 1, maximum: 8 },
        limit: { type: "number" },
      },
      required: ["brand", "query"],
    },
  },
  {
    name: "festival_sync",
    description: "Submit festivals to the FestivalCalendar.online pipeline: ingest → dedup → SEO → publish.",
    inputSchema: {
      type: "object",
      properties: {
        festivals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:        { type: "string" },
              city:        { type: "string" },
              state:       { type: "string" },
              country:     { type: "string" },
              category:    { type: "string", enum: ["Music", "Food", "Art", "Wellness", "Cultural", "Spiritual"] },
              start_date:  { type: "string" },
              end_date:    { type: "string" },
              description: { type: "string" },
              website:     { type: "string" },
              ticket_url:  { type: "string" },
              featured:    { type: "boolean" },
            },
            required: ["name", "city", "category"],
          },
        },
        brand:  { type: "string" },
        source: { type: "string" },
      },
      required: ["festivals"],
    },
  },
  {
    name: "festival_list",
    description: "Browse festivals in the FestivalCalendar.online database.",
    inputSchema: {
      type: "object",
      properties: {
        city:     { type: "string" },
        state:    { type: "string" },
        category: { type: "string", enum: ["Music", "Food", "Art", "Wellness", "Cultural", "Spiritual"] },
        status:   { type: "string", enum: ["pending", "dedup_checked", "seo_generated", "published", "duplicate", "rejected"] },
        brand:    { type: "string" },
        batch_id: { type: "string" },
        limit:    { type: "number" },
      },
    },
  },
  // ─── Artifact / Router-Tag Spine (S1/S2) — substrate for Lotus ──────────────
  {
    name: "artifact_ingest",
    description: "Ingest an artifact: validates, assigns uuid + timestamp + version + hash, and stores it with a router-tag. Returns the artifact and its router-tag.",
    inputSchema: {
      type: "object",
      properties: {
        brand:   { type: "string", description: "Brand slug" },
        title:   { type: "string", description: "Artifact title" },
        body:    { type: "string", description: "Inline content (hashed)" },
        ref:     { type: "string", description: "Pointer/URL when content is not inline" },
        vault:   { type: "string", description: "Canonical vault slug (default: creative-drafts)" },
        switch:  { type: "number", description: "Sales Switch 1..7 (optional)" },
        source:  { type: "string", enum: ["blume-generated", "manual", "imported", "published", "system"], description: "Default: manual" },
        metadata: { type: "object", description: "Open metadata (campaign, channels, platform, ...)" },
      },
      required: ["brand", "title"],
    },
  },
  {
    name: "artifact_list",
    description: "List artifacts for a brand, optionally filtered by vault slug and/or Sales Switch. (The call the Lotus Engine uses to score a brand.)",
    inputSchema: {
      type: "object",
      properties: {
        brand:  { type: "string", description: "Brand slug" },
        vault:  { type: "string", description: "Filter by canonical vault slug" },
        switch: { type: "number", description: "Filter by Sales Switch 1..7" },
        limit:  { type: "number", description: "Max results" },
      },
      required: ["brand"],
    },
  },
  {
    name: "artifact_get",
    description: "Fetch a single artifact by uuid (optionally scoped to a brand).",
    inputSchema: {
      type: "object",
      properties: {
        uuid:  { type: "string", description: "Artifact uuid" },
        brand: { type: "string", description: "Brand slug (optional; speeds lookup)" },
      },
      required: ["uuid"],
    },
  },
  {
    name: "routertag_validate",
    description: "Validate a router-tag object against the contract. Returns { valid, errors }.",
    inputSchema: {
      type: "object",
      properties: {
        routertag: { type: "object", description: "A router-tag: {uuid, brand, vault, switch, title, timestamp, version, source, hash, metadata}" },
      },
      required: ["routertag"],
    },
  },
  {
    name: "vault_registry",
    description: "List the canonical vault registry (slug, doctrine number, tier, legacy integer, active).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "artifact_migrate_legacy",
    description: "Map existing vault entries → artifacts by slug. DRY-RUN by default; pass dry_run=false to actually write. Existing vault entries keep working regardless.",
    inputSchema: {
      type: "object",
      properties: {
        brand:   { type: "string", description: "Limit to one brand (optional)" },
        dry_run: { type: "boolean", description: "Default: true (no writes)" },
      },
    },
  },
  // ─── Lotus Engine (S4) — scoring & launch readiness ────────────────────────
  {
    name: "lotus_readiness",
    description: "Lotus Engine: score a brand's launch readiness. Returns the 5 sub-scores (Content/Audience/Offer/Proof/Monetization, each 0–20) + Launch Readiness Index (0–100) + band (Go ≥85 / Final-Prep / Structuring / Dev). Computed from the brand's artifacts.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string", description: "Brand slug" },
      },
      required: ["brand"],
    },
  },
  {
    name: "lotus_score_config",
    description: "Inspect the active Lotus scoring rubric (categories, sources, weights, bands).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "lotus_bottleneck",
    description: "Lotus: the single lowest-scoring readiness category gating a brand, its score, the current band, and how many index points reach the next band.",
    inputSchema: {
      type: "object",
      properties: { brand: { type: "string", description: "Brand slug" } },
      required: ["brand"],
    },
  },
  {
    name: "lotus_missing_evidence",
    description: "Lotus: readiness categories that are empty (critical) or thin, each with a suggested artifact to add. Turns a score into next actions.",
    inputSchema: {
      type: "object",
      properties: { brand: { type: "string", description: "Brand slug" } },
      required: ["brand"],
    },
  },
];

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: config.server.name, version: config.server.version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;
  const args = rawArgs ?? {};

  try {
    switch (name) {
      case "blume_generate_post": {
        const post = await generatePost({
          brand:      String(args.brand),
          platform:   args.platform as PostRequest["platform"],
          goal:       args.goal as PostRequest["goal"],
          aidaStage:  (args.aida_stage as PostRequest["aidaStage"]) ?? "attention",
          mode:       (args.mode as PostRequest["mode"]) ?? "collaborative",
          topic:      args.topic ? String(args.topic) : undefined,
          humanLoop:  args.human_loop !== false,
        });
        return { content: [{ type: "text", text: JSON.stringify(post, null, 2) }] };
      }

      case "blume_aida_sequence": {
        const posts = await generateAIDASequence(
          String(args.brand),
          args.platform as PostRequest["platform"],
          args.goal as PostRequest["goal"],
          (args.mode as PostRequest["mode"]) ?? "collaborative",
          args.topic ? String(args.topic) : undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(posts, null, 2) }] };
      }

      case "blume_generate_offer": {
        const offer = await generateOffer(String(args.brand), Number(args.offer_number ?? 1));
        return { content: [{ type: "text", text: JSON.stringify(offer, null, 2) }] };
      }

      case "blume_generate_email": {
        const email = await generateEmail(String(args.brand), String(args.sequence_type));
        return { content: [{ type: "text", text: JSON.stringify(email, null, 2) }] };
      }

      case "blume_diagnose_switch": {
        const result = await diagnoseBrand(String(args.brand), String(args.context));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "blume_analyze_site": {
        const insight = await analyzeSiteForBrand(String(args.url), String(args.brand));
        return { content: [{ type: "text", text: JSON.stringify(insight, null, 2) }] };
      }

      case "seo_generate": {
        const seo = await generateSEOContent({
          brand: String(args.brand),
          topic: String(args.topic),
          url:   args.url ? String(args.url) : undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(seo, null, 2) }] };
      }

      case "blume_list_brands": {
        const brands = listBrands();
        return { content: [{ type: "text", text: JSON.stringify({ count: brands.length, brands }) }] };
      }

      case "blume_add_brand": {
        const profile: BrandProfile = {
          slug:    String(args.slug),
          name:    String(args.name),
          domain:  String(args.domain),
          tagline: String(args.tagline),
          voice: {
            archetype:      args.voice_archetype   ? String(args.voice_archetype)   : "Brand Voice",
            tone:           args.voice_tone        ? String(args.voice_tone)        : "professional, authentic",
            personality:    args.voice_personality ? String(args.voice_personality) : "clear and direct",
            do:             Array.isArray(args.voice_do)      ? (args.voice_do as string[])      : ["Be authentic"],
            dont:           Array.isArray(args.voice_dont)    ? (args.voice_dont as string[])    : ["Don't be generic"],
            sample_phrases: Array.isArray(args.sample_phrases)? (args.sample_phrases as string[]): [],
          },
          aida: {
            attention_hook: args.aida_attention ? String(args.aida_attention) : "bold, direct hook",
            interest:       args.aida_interest  ? String(args.aida_interest)  : "introduce the value proposition",
            desire:         args.aida_desire    ? String(args.aida_desire)    : "paint the transformation",
            action:         args.aida_action    ? String(args.aida_action)    : "clear call to action",
          },
          platforms: Array.isArray(args.platforms) ? (args.platforms as string[]) : ["twitter"],
        };
        if (args.entity) profile.entity = String(args.entity);
        addBrand(profile);
        initBrandVaults(profile.slug);
        return { content: [{ type: "text", text: `Brand "${profile.name}" (${profile.slug}) registered. Vaults initialized.` }] };
      }

      case "blume_remove_brand": {
        removeBrand(String(args.slug));
        return { content: [{ type: "text", text: `Brand "${args.slug}" removed. Vaults preserved.` }] };
      }

      case "blume_init_vaults": {
        initBrandVaults(String(args.brand));
        return { content: [{ type: "text", text: `All 8 vaults initialized for brand: ${args.brand}` }] };
      }

      case "blume_vault_summary": {
        const summary = getBrandVaultSummary(String(args.brand));
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }

      case "blume_read_vault": {
        const entries = readVault(String(args.brand), Number(args.vault) as VaultNumber);
        const limit = Number(args.limit ?? 10);
        return { content: [{ type: "text", text: JSON.stringify(entries.slice(0, limit), null, 2) }] };
      }

      case "blume_log_to_vault": {
        const vaultNum = Number(args.vault) as VaultNumber;
        const brandStr = String(args.brand);
        const entry = saveToVault(brandStr, vaultNum, {
          vault:   vaultNum,
          brand:   brandStr,
          title:   String(args.title),
          content: String(args.content),
          tags:    Array.isArray(args.tags) ? (args.tags as string[]) : [],
          metadata: {},
        });
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      }

      case "vault_search": {
        const vault = args.vault ? (Number(args.vault) as VaultNumber) : undefined;
        const results = searchVaults(String(args.brand), String(args.query), vault);
        const limit = args.limit ? Number(args.limit) : 20;
        return { content: [{ type: "text", text: JSON.stringify({ count: results.length, results: results.slice(0, limit) }, null, 2) }] };
      }

      case "festival_sync": {
        const festivals = args.festivals as FestivalInput[];
        if (!Array.isArray(festivals) || festivals.length === 0) {
          return { content: [{ type: "text", text: "Provide at least one festival." }] };
        }
        const result = await ingestFestivals({
          festivals,
          brand:  args.brand  ? String(args.brand)  : "festivalcalendar",
          source: args.source ? String(args.source) : "mcp",
        });
        return { content: [{ type: "text", text: JSON.stringify({ status: "pipeline_started", ...result }, null, 2) }] };
      }

      case "festival_list": {
        const festivals = await dbListFestivals({
          city:     args.city     ? String(args.city)                  : undefined,
          state:    args.state    ? String(args.state)                 : undefined,
          category: args.category ? args.category as FestivalCategory  : undefined,
          status:   args.status   ? args.status   as FestivalStatus    : undefined,
          brand:    args.brand    ? String(args.brand)                 : undefined,
          batch_id: args.batch_id ? String(args.batch_id)              : undefined,
          limit:    args.limit    ? Number(args.limit)                 : undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify({ count: festivals.length, festivals }, null, 2) }] };
      }

      // ─── Artifact / Router-Tag Spine (S1/S2) ─────────────────────────────
      case "artifact_ingest": {
        const result = ingestArtifact({
          brand:    String(args.brand),
          title:    String(args.title),
          body:     args.body !== undefined ? String(args.body) : undefined,
          ref:      args.ref !== undefined ? String(args.ref) : undefined,
          vault:    args.vault !== undefined ? String(args.vault) : undefined,
          switch:   args.switch !== undefined ? Number(args.switch) : undefined,
          source:   args.source !== undefined ? (String(args.source) as ArtifactSource) : undefined,
          metadata: (args.metadata && typeof args.metadata === "object") ? (args.metadata as Record<string, unknown>) : undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "artifact_list": {
        const arts = listArtifacts({
          brand:  String(args.brand),
          vault:  args.vault !== undefined ? String(args.vault) : undefined,
          switch: args.switch !== undefined ? Number(args.switch) : undefined,
          limit:  args.limit !== undefined ? Number(args.limit) : undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify({ count: arts.length, artifacts: arts }, null, 2) }] };
      }

      case "artifact_get": {
        const art = getArtifact(String(args.uuid), args.brand !== undefined ? String(args.brand) : undefined);
        return { content: [{ type: "text", text: art ? JSON.stringify(art, null, 2) : `Artifact not found: ${args.uuid}` }], isError: !art };
      }

      case "routertag_validate": {
        const result = validateRouterTag((args.routertag ?? {}) as Partial<RouterTag>);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "vault_registry": {
        return { content: [{ type: "text", text: JSON.stringify(listVaultRegistry(), null, 2) }] };
      }

      case "artifact_migrate_legacy": {
        const report = migrateLegacyVaultEntries({
          brand:  args.brand !== undefined ? String(args.brand) : undefined,
          dryRun: args.dry_run !== false,
        });
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      }

      // ─── Lotus Engine (S4) ───────────────────────────────────────────────
      case "lotus_readiness": {
        const readiness = computeReadiness(String(args.brand));
        return { content: [{ type: "text", text: JSON.stringify(readiness, null, 2) }] };
      }

      case "lotus_score_config": {
        return { content: [{ type: "text", text: JSON.stringify(getLotusConfig(), null, 2) }] };
      }

      case "lotus_bottleneck": {
        return { content: [{ type: "text", text: JSON.stringify(detectBottleneck(String(args.brand)), null, 2) }] };
      }

      case "lotus_missing_evidence": {
        return { content: [{ type: "text", text: JSON.stringify(detectMissingEvidence(String(args.brand)), null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `[BLUME ERROR] ${message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${config.server.name}] v${config.server.version} online. Generation + listings ready.`);
}

main().catch(console.error);
