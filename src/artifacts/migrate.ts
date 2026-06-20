/**
 * Legacy migration path (S1) — map existing vault entries → artifacts by SLUG.
 * Spec: build/ARTIFACT_SPINE_SPEC_v1.md §6 (`artifact_migrate_legacy`).
 *
 * Default is dry-run. Full migration is NOT performed unless explicitly requested —
 * existing vault entries keep functioning either way (no breaking changes).
 */

import { listBrands } from "../brands/registry.js";
import { readVault } from "../vault/index.js";
import type { VaultNumber } from "../vault/types.js";
import { vaultFromLegacyInt } from "./registry.js";
import { computeHash, newUuid } from "./routerTag.js";
import { persistArtifact } from "./store.js";
import type { Artifact } from "./types.js";

export interface MigrationReport {
  dryRun: boolean;
  scanned: number;
  mapped: number;
  byBrand: Record<string, number>;
  errors: string[];
}

export function migrateLegacyVaultEntries(opts: { brand?: string; dryRun?: boolean } = {}): MigrationReport {
  const dryRun = opts.dryRun !== false; // default TRUE — do not migrate unless explicitly told
  const brands = opts.brand ? [opts.brand] : listBrands();

  let scanned = 0;
  let mapped = 0;
  const byBrand: Record<string, number> = {};
  const errors: string[] = [];

  for (const brand of brands) {
    for (let v = 1; v <= 8; v++) {
      const entries = readVault(brand, v as VaultNumber);
      for (const e of entries) {
        scanned++;
        const reg = vaultFromLegacyInt(v);
        if (!reg) {
          errors.push(`${brand}: no registry slug for legacy vault ${v}`);
          continue;
        }
        if (!dryRun) {
          const body = e.content ?? "";
          const now = new Date().toISOString();
          const art: Artifact = {
            uuid: newUuid(),
            brand,
            vault: reg.slug,
            switch: null,
            title: e.title,
            timestamp: e.createdAt ?? now,
            version: 1,
            source: "imported",
            hash: computeHash(body),
            metadata: { ...e.metadata, legacy_id: e.id, legacy_vault_int: v, tags: e.tags },
            body,
            ref: null,
            parent_uuid: null,
            updated_at: e.updatedAt ?? now,
          };
          persistArtifact(art);
        }
        mapped++;
        byBrand[brand] = (byBrand[brand] ?? 0) + 1;
      }
    }
  }

  return { dryRun, scanned, mapped, byBrand, errors };
}
