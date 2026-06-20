/**
 * Vault taxonomy — the canonical 12 vaults (BLUME-032).
 *
 * Single source of truth: `../artifacts/registry.ts`. The SLUG is canonical; the integer is
 * legacy-compat only. Integers 1–8 keep their original meaning (keyed by `registry.legacy_int`),
 * 9–12 use the doctrine number (R&D 9 · Compliance 10 · Memory 11 · Library 12). Compliance is parked.
 */

import { VAULT_REGISTRY } from "../artifacts/registry.js";

export type VaultNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** int → canonical slug, derived from the registry (legacy_int for 1–8, doctrine_no for 9–12). */
export const VAULT_NAMES: Record<VaultNumber, string> = (() => {
  const m = {} as Record<VaultNumber, string>;
  for (const v of VAULT_REGISTRY) {
    const n = (v.legacy_int ?? v.doctrine_no) as VaultNumber;
    m[n] = v.slug;
  }
  return m;
})();

export const VAULT_DESCRIPTIONS: Record<VaultNumber, string> = {
  1: "All released products, videos, PDFs, posts",         // published-works
  2: "Screenshots, URLs, first-use logs, proof of use",     // proof-of-use
  3: "Sales reports, receipts, transaction evidence",       // commerce-evidence
  4: "Logos, palettes, templates, brand guides",            // brand-assets
  5: "Copyright, licensing, trademark, legal",              // legal
  6: "Unreleased ideas, mockups, drafts",                   // creative-drafts
  7: "Strategy notes, confidential decisions",              // internal-notes
  8: "Crowdfunding, equity, investor comms, traction",      // investor
  9: "R&D, experimental AI, market/competitive intel",      // rnd
  10: "Compliance (PARKED — reeval Sep–Dec 2026)",          // compliance
  11: "Institutional memory — decisions, learnings",        // memory (sovereign)
  12: "Library of Toravian — lineage (trustee-only)",       // library (sovereign)
};

/** Vaults initialized by default — active only (Compliance(10) is parked). */
export const ACTIVE_VAULTS: VaultNumber[] = (Object.keys(VAULT_NAMES) as string[])
  .map(n => Number(n) as VaultNumber)
  .filter(n => n !== 10)
  .sort((a, b) => a - b);

export interface VaultEntry {
  id: string;
  vault: VaultNumber;
  brand: string;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
