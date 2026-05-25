/**
 * BLUME CLI — Standalone content generation and export.
 *
 * Usage:
 *   npx tsx src/cli.ts init-vaults
 *   npx tsx src/cli.ts bulk-generate [--posts 30] [--offers 5] [--emails 3]
 *   npx tsx src/cli.ts export-all
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { think } from "./integrations/ai.js";
import { loadBrand, listBrands } from "./brands/registry.js";
import { initBrandVaults, saveToVault } from "./vault/index.js";
import { getBlumeSystemPrompt, PLATFORM_LIMITS } from "./content/persona.js";
import { config } from "./config.js";
import type { BlumeMode } from "./content/persona.js";
import type { VaultNumber } from "./vault/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = path.resolve(__dirname, "../exports");
const VAULTS_DIR = config.vault.root;

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith("--") && raw[i + 1] && !raw[i + 1].startsWith("--")) {
      args[raw[i].replace("--", "")] = raw[i + 1];
      i++;
    }
  }
  return args;
}

function log(msg: string) { console.log(`[BLUME] ${msg}`); }
function err(msg: string) { console.error(`[BLUME ERROR] ${msg}`); }

function cmdInitVaults() {
  const brands = listBrands();
  if (brands.length === 0) { err("No brands found."); process.exit(1); }
  for (const slug of brands) initBrandVaults(slug);
  log(`Initialized vaults for ${brands.length} brands: ${brands.join(", ")}`);
}

async function generatePostForBrand(
  brandSlug: string,
  platform: string,
  goal: string,
  aidaStage: string,
  mode: BlumeMode
): Promise<string> {
  const brand = loadBrand(brandSlug);
  const systemPrompt = getBlumeSystemPrompt(mode, brand);
  const limit = PLATFORM_LIMITS[platform] ?? 280;

  const userMessage = `
Write a ${platform} post for ${brand.name}.
AIDA Stage: ${aidaStage.toUpperCase()}
Goal: ${goal}
Platform character limit: ${limit}
AIDA guidance:
- Attention hook: ${brand.aida.attention_hook}
- Interest: ${brand.aida.interest}
- Desire: ${brand.aida.desire}
- Action: ${brand.aida.action}
Write ONLY the post content. No labels. Stay under ${limit} characters.
  `.trim();

  return (await think(systemPrompt, userMessage, { fast: true })).trim();
}

async function cmdBulkGenerate(postCount: number, offerCount: number, emailCount: number) {
  if (!config.openai.apiKey && !config.anthropic.apiKey) {
    err("No AI API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env");
    process.exit(1);
  }

  const brands = listBrands();
  log(`Generating content for ${brands.length} brands`);
  log(`Target: ${postCount} posts, ${offerCount} offers, ${emailCount} emails per brand`);

  const platforms = ["twitter", "instagram", "linkedin"];
  const goals = ["awareness", "engagement", "conversion", "retention", "launch"];
  const aidaStages = ["attention", "interest", "desire", "action"];
  const modes: BlumeMode[] = ["collaborative", "dominion_rex", "venus_protocol", "commerce", "insight", "grace"];
  const emailTypes = ["welcome", "nurture", "conversion"];

  for (const brandSlug of brands) {
    log(`\n--- ${brandSlug} ---`);
    const brand = loadBrand(brandSlug);
    const brandPlatforms = brand.platforms?.length ? brand.platforms : platforms;

    log(`  Generating ${postCount} posts...`);
    for (let i = 0; i < postCount; i++) {
      const platform = brandPlatforms[i % brandPlatforms.length];
      const goal = goals[i % goals.length];
      const aidaStage = aidaStages[i % aidaStages.length];
      const mode = modes[i % modes.length];
      try {
        const text = await generatePostForBrand(brandSlug, platform, goal, aidaStage, mode);
        saveToVault(brandSlug, 6, {
          vault: 6, brand: brandSlug,
          title: `${platform} | ${aidaStage} | ${mode} — draft`,
          content: text,
          tags: ["social-post", "draft", platform, aidaStage, mode, goal],
          metadata: { platform, mode, aidaStage, goal, generatedAt: new Date().toISOString() },
        });
        log(`    [${i + 1}/${postCount}] ${platform}/${aidaStage}/${mode} — ${text.length} chars`);
      } catch (e) {
        err(`    [${i + 1}/${postCount}] FAILED: ${(e as Error).message}`);
      }
    }

    log(`  Generating ${offerCount} offers...`);
    for (let i = 0; i < offerCount; i++) {
      try {
        const systemPrompt = getBlumeSystemPrompt("commerce", brand);
        const raw = (await think(systemPrompt, `Create promotional offer #${i + 1} for ${brand.name}. HEADLINE / BODY / CTA format.`, { fast: true })).trim();
        const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
        const title = headlineMatch?.[1]?.trim() ?? `Offer #${i + 1}`;
        saveToVault(brandSlug, 6, {
          vault: 6, brand: brandSlug,
          title: `Offer: ${title}`,
          content: raw,
          tags: ["offer", "draft"],
          metadata: { offerNumber: i + 1, generatedAt: new Date().toISOString() },
        });
        log(`    [${i + 1}/${offerCount}] "${title}"`);
      } catch (e) {
        err(`    [${i + 1}/${offerCount}] FAILED: ${(e as Error).message}`);
      }
    }

    log(`  Generating ${emailCount} email sequences...`);
    for (let i = 0; i < emailCount; i++) {
      const seqType = emailTypes[i % emailTypes.length];
      try {
        const systemPrompt = getBlumeSystemPrompt("collaborative", brand);
        const raw = (await think(systemPrompt, `Write a ${seqType} email for ${brand.name}. SUBJECT / BODY / CTA format.`, { fast: false })).trim();
        const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
        const subject = subjectMatch?.[1]?.trim() ?? `${brand.name} — ${seqType}`;
        saveToVault(brandSlug, 6, {
          vault: 6, brand: brandSlug,
          title: `Email: ${seqType} — ${subject}`,
          content: raw,
          tags: ["email", "draft", seqType],
          metadata: { sequence: seqType, generatedAt: new Date().toISOString() },
        });
        log(`    [${i + 1}/${emailCount}] ${seqType}: "${subject}"`);
      } catch (e) {
        err(`    [${i + 1}/${emailCount}] FAILED: ${(e as Error).message}`);
      }
    }
  }

  log(`\nBULK GENERATE COMPLETE across ${brands.length} brands.`);
  log(`All drafts saved to Vault 6 (Creative Drafts) per brand.`);
}

function cmdExportAll() {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const brands = listBrands();
  let exported = 0;

  const vaultNames: Record<number, string> = {
    1: "published-works", 2: "proof-of-use", 3: "commerce-evidence",
    4: "brand-assets", 5: "legal-disclaimers", 6: "creative-drafts",
    7: "internal-notes", 8: "investment-funding",
  };

  for (const brandSlug of brands) {
    const brandVaultDir = path.resolve(VAULTS_DIR, brandSlug);
    if (!fs.existsSync(brandVaultDir)) { log(`Skipping ${brandSlug} — no vaults`); continue; }

    const brandExport: Record<string, unknown[]> = {};
    for (let v = 1; v <= 8; v++) {
      const vaultDir = path.join(brandVaultDir, `vault-${v}-${vaultNames[v]}`);
      if (!fs.existsSync(vaultDir)) { brandExport[`vault-${v}-${vaultNames[v]}`] = []; continue; }
      brandExport[`vault-${v}-${vaultNames[v]}`] = fs.readdirSync(vaultDir)
        .filter(f => f.endsWith(".json"))
        .map(f => JSON.parse(fs.readFileSync(path.join(vaultDir, f), "utf-8")));
    }

    const vault6 = brandExport["vault-6-creative-drafts"] as Array<{ tags?: string[] }>;
    const posts  = vault6.filter(e => e.tags?.includes("social-post"));
    const offers = vault6.filter(e => e.tags?.includes("offer"));
    const emails = vault6.filter(e => e.tags?.includes("email"));

    const outPath = path.join(EXPORTS_DIR, `${brandSlug}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ brand: brandSlug, exportedAt: new Date().toISOString(), summary: { posts: posts.length, offers: offers.length, emails: emails.length }, posts, offers, emails, vaults: brandExport }, null, 2), "utf-8");
    log(`Exported ${brandSlug} → ${outPath}`);
    exported++;
  }

  log(`\nEXPORT COMPLETE: ${exported} brand files written to /exports/`);
}

async function main() {
  const command = process.argv[2];
  const args = parseArgs();

  switch (command) {
    case "init-vaults":
      cmdInitVaults();
      break;
    case "bulk-generate": {
      const posts  = parseInt(args.posts  ?? "30", 10);
      const offers = parseInt(args.offers ?? "5",  10);
      const emails = parseInt(args.emails ?? "3",  10);
      await cmdBulkGenerate(posts, offers, emails);
      break;
    }
    case "export-all":
      cmdExportAll();
      break;
    default:
      console.log(`
BLUME CLI — Content Generation & Export

Commands:
  init-vaults                                       Initialize 8 vaults for all brands
  bulk-generate [--posts N] [--offers N] [--emails N]  Generate content for all brands
  export-all                                        Export all vault data to /exports/ as JSON
      `);
  }
}

main().catch(e => { err(e.message); process.exit(1); });
