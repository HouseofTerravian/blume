/**
 * BLUME Vault System — 8-Vault Brand Archive
 * Dual storage: Supabase (primary) + local files (fallback).
 */
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { isSupabaseEnabled, dbSaveVaultEntry, dbGetVaultSummary } from "../integrations/supabase.js";
import { VAULT_NAMES } from "./types.js";
function getBrandVaultDir(brand) {
    return path.join(config.vault.root, brand);
}
function getVaultDir(brand, vault) {
    return path.join(getBrandVaultDir(brand), `vault-${vault}-${VAULT_NAMES[vault]}`);
}
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
export function initBrandVaults(brand) {
    for (let v = 1; v <= 8; v++) {
        ensureDir(getVaultDir(brand, v));
    }
    console.log(`[Vault] Initialized all 8 vaults for brand: ${brand}`);
}
export function saveToVault(brand, vault, entry) {
    const dir = getVaultDir(brand, vault);
    ensureDir(dir);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const full = { ...entry, id, vault, brand, createdAt: now, updatedAt: now };
    const filePath = path.join(dir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(full, null, 2), "utf-8");
    if (isSupabaseEnabled()) {
        const dbEntry = {
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
        dbSaveVaultEntry(dbEntry).catch(err => console.error("[Vault] Supabase sync failed:", err));
    }
    return full;
}
export function readVault(brand, vault) {
    const dir = getVaultDir(brand, vault);
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir)
        .filter(f => f.endsWith(".json"))
        .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function logPost(brand, post) {
    return saveToVault(brand, 1, {
        vault: 1,
        brand,
        title: `${post.platform} post — ${new Date().toLocaleDateString()}`,
        content: post.content,
        tags: ["social-post", post.platform],
        metadata: { platform: post.platform, postId: post.postId ?? null },
    });
}
export function logCommerceEvent(brand, event) {
    return saveToVault(brand, 3, {
        vault: 3,
        brand,
        title: `${event.type} — ${new Date().toISOString()}`,
        content: event.description,
        tags: ["commerce", event.type],
        metadata: { amount: event.amount, proof: event.proof },
    });
}
export function logProofOfUse(brand, proof) {
    return saveToVault(brand, 2, {
        vault: 2,
        brand,
        title: `Proof of Use — ${new Date().toLocaleDateString()}`,
        content: proof.description,
        tags: ["proof-of-use"],
        metadata: { url: proof.url, screenshot: proof.screenshot },
    });
}
export function searchVaults(brand, query, vault) {
    const lower = query.toLowerCase();
    const vaults = vault ? [vault] : [1, 2, 3, 4, 5, 6, 7, 8];
    const results = [];
    for (const v of vaults) {
        const entries = readVault(brand, v);
        for (const entry of entries) {
            if (entry.title.toLowerCase().includes(lower) ||
                entry.content.toLowerCase().includes(lower) ||
                entry.tags.some(t => t.toLowerCase().includes(lower))) {
                results.push(entry);
            }
        }
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getBrandVaultSummary(brand) {
    const summary = {};
    for (let v = 1; v <= 8; v++) {
        const vaultNum = v;
        summary[`vault-${v}-${VAULT_NAMES[vaultNum]}`] = readVault(brand, vaultNum).length;
    }
    if (isSupabaseEnabled()) {
        dbGetVaultSummary(brand).catch(() => { });
    }
    return summary;
}
//# sourceMappingURL=index.js.map