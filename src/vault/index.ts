/**
 * BLUME Vault System — 8-Vault Brand Archive
 * Dual storage: Supabase (primary) + local files (fallback).
 */

import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { isSupabaseEnabled, dbSaveVaultEntry, dbReadVault, dbGetVaultSummary } from "../integrations/supabase.js";
import type { DbVaultEntry } from "../integrations/supabase.js";
import { VAULT_NAMES, ACTIVE_VAULTS } from "./types.js";
import type { VaultNumber, VaultEntry } from "./types.js";

const ALL_VAULTS: VaultNumber[] = (Object.keys(VAULT_NAMES) as string[])
  .map(n => Number(n) as VaultNumber)
  .sort((a, b) => a - b);

function getBrandVaultDir(brand: string): string {
  return path.join(config.vault.root, brand);
}

function getVaultDir(brand: string, vault: VaultNumber): string {
  return path.join(getBrandVaultDir(brand), `vault-${vault}-${VAULT_NAMES[vault]}`);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function initBrandVaults(brand: string): void {
  for (const v of ACTIVE_VAULTS) {
    ensureDir(getVaultDir(brand, v));
  }
  console.log(`[Vault] Initialized ${ACTIVE_VAULTS.length} active vaults for brand: ${brand}`);
}

export function saveToVault(
  brand: string,
  vault: VaultNumber,
  entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">
): VaultEntry {
  const dir = getVaultDir(brand, vault);
  ensureDir(dir);

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const full: VaultEntry = { ...entry, id, vault, brand, createdAt: now, updatedAt: now };

  const filePath = path.join(dir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(full, null, 2), "utf-8");

  if (isSupabaseEnabled()) {
    const dbEntry: DbVaultEntry = {
      id: full.id,
      brand: full.brand,
      vault: full.vault,
      vault_name: VAULT_NAMES[full.vault],
      title: full.title,
      content: full.content,
      tags: full.tags,
      metadata: full.metadata,
      created_at: full.createdAt,
      updated_at: full.updatedAt,
    };
    dbSaveVaultEntry(dbEntry).catch(err =>
      console.error("[Vault] Supabase sync failed:", err)
    );
  }

  return full;
}

export function readVault(brand: string, vault: VaultNumber): VaultEntry[] {
  const dir = getVaultDir(brand, vault);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as VaultEntry)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function logPost(brand: string, post: { platform: string; content: string; postId?: string }): VaultEntry {
  return saveToVault(brand, 1, {
    vault: 1,
    brand,
    title: `${post.platform} post — ${new Date().toLocaleDateString()}`,
    content: post.content,
    tags: ["social-post", post.platform],
    metadata: { platform: post.platform, postId: post.postId ?? null },
  });
}

export function logCommerceEvent(
  brand: string,
  event: { type: string; amount?: number; description: string; proof?: string }
): VaultEntry {
  return saveToVault(brand, 3, {
    vault: 3,
    brand,
    title: `${event.type} — ${new Date().toISOString()}`,
    content: event.description,
    tags: ["commerce", event.type],
    metadata: { amount: event.amount, proof: event.proof },
  });
}

export function logProofOfUse(
  brand: string,
  proof: { url?: string; screenshot?: string; description: string }
): VaultEntry {
  return saveToVault(brand, 2, {
    vault: 2,
    brand,
    title: `Proof of Use — ${new Date().toLocaleDateString()}`,
    content: proof.description,
    tags: ["proof-of-use"],
    metadata: { url: proof.url, screenshot: proof.screenshot },
  });
}

export function searchVaults(
  brand: string,
  query: string,
  vault?: VaultNumber
): VaultEntry[] {
  const lower = query.toLowerCase();
  const vaults: VaultNumber[] = vault ? [vault] : ALL_VAULTS;
  const results: VaultEntry[] = [];

  for (const v of vaults) {
    const entries = readVault(brand, v);
    for (const entry of entries) {
      if (
        entry.title.toLowerCase().includes(lower) ||
        entry.content.toLowerCase().includes(lower) ||
        entry.tags.some(t => t.toLowerCase().includes(lower))
      ) {
        results.push(entry);
      }
    }
  }

  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBrandVaultSummary(brand: string): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const v of ALL_VAULTS) {
    summary[`vault-${v}-${VAULT_NAMES[v]}`] = readVault(brand, v).length;
  }

  if (isSupabaseEnabled()) {
    dbGetVaultSummary(brand).catch(() => {});
  }

  return summary;
}

export type { VaultNumber, VaultEntry };
