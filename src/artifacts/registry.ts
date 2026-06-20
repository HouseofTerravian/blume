/**
 * Canonical Vault Registry (doctrine order, slug-keyed).
 * Fixes the legacy integer permutation: the SLUG is canonical; integers are compat-only.
 * Spec: build/ARTIFACT_SPINE_SPEC_v1.md §7.
 *
 * legacy_int maps the old `thq_vault_entries`/VaultEntry code integers (1..8) to slugs,
 * so migration is by name with no data loss.
 */

import type { VaultRegistryEntry } from "./types.js";

export const VAULT_REGISTRY: VaultRegistryEntry[] = [
  { slug: "brand-assets",      doctrine_no: 1,  display: "Brand Assets",          tier: "core",      legacy_int: 4,    active: true },
  { slug: "published-works",   doctrine_no: 2,  display: "Published Works",       tier: "core",      legacy_int: 1,    active: true },
  { slug: "proof-of-use",      doctrine_no: 3,  display: "Proof of Use",          tier: "core",      legacy_int: 2,    active: true },
  { slug: "commerce-evidence", doctrine_no: 4,  display: "Commerce Evidence",     tier: "core",      legacy_int: 3,    active: true },
  { slug: "creative-drafts",   doctrine_no: 5,  display: "Creative Drafts",       tier: "core",      legacy_int: 6,    active: true },
  { slug: "internal-notes",    doctrine_no: 6,  display: "Internal Notes",        tier: "core",      legacy_int: 7,    active: true },
  { slug: "legal",             doctrine_no: 7,  display: "Legal",                 tier: "core",      legacy_int: 5,    active: true },
  { slug: "investor",          doctrine_no: 8,  display: "Investor",              tier: "core",      legacy_int: 8,    active: true },
  { slug: "rnd",               doctrine_no: 9,  display: "R&D / Experimental AI", tier: "extended",  legacy_int: null, active: true },
  { slug: "compliance",        doctrine_no: 10, display: "Compliance",            tier: "extended",  legacy_int: null, active: false }, // PARKED (reeval Sep–Dec 2026)
  { slug: "memory",            doctrine_no: 11, display: "Memory",                tier: "sovereign", legacy_int: null, active: true },
  { slug: "library",           doctrine_no: 12, display: "Library of Toravian",   tier: "sovereign", legacy_int: null, active: true },
];

const BY_SLUG = new Map<string, VaultRegistryEntry>(VAULT_REGISTRY.map(v => [v.slug, v]));
const BY_LEGACY = new Map<number, VaultRegistryEntry>(
  VAULT_REGISTRY.filter(v => v.legacy_int != null).map(v => [v.legacy_int as number, v]),
);

export const DEFAULT_VAULT_SLUG = "creative-drafts";

export function isValidVaultSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

export function getVault(slug: string): VaultRegistryEntry | undefined {
  return BY_SLUG.get(slug);
}

export function vaultFromLegacyInt(n: number): VaultRegistryEntry | undefined {
  return BY_LEGACY.get(n);
}

export function listVaultRegistry(): VaultRegistryEntry[] {
  return VAULT_REGISTRY;
}
