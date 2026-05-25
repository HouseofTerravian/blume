/**
 * BLUME Vault System — 8-Vault Brand Archive
 * Dual storage: Supabase (primary) + local files (fallback).
 */
import type { VaultNumber, VaultEntry } from "./types.js";
export declare function initBrandVaults(brand: string): void;
export declare function saveToVault(brand: string, vault: VaultNumber, entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">): VaultEntry;
export declare function readVault(brand: string, vault: VaultNumber): VaultEntry[];
export declare function logPost(brand: string, post: {
    platform: string;
    content: string;
    postId?: string;
}): VaultEntry;
export declare function logCommerceEvent(brand: string, event: {
    type: string;
    amount?: number;
    description: string;
    proof?: string;
}): VaultEntry;
export declare function logProofOfUse(brand: string, proof: {
    url?: string;
    screenshot?: string;
    description: string;
}): VaultEntry;
export declare function searchVaults(brand: string, query: string, vault?: VaultNumber): VaultEntry[];
export declare function getBrandVaultSummary(brand: string): Record<string, number>;
export type { VaultNumber, VaultEntry };
//# sourceMappingURL=index.d.ts.map