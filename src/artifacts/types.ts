/**
 * Artifact / Router-Tag Spine — canonical types (S1/S2).
 * Spec: build/ARTIFACT_SPINE_SPEC_v1.md · Doctrine: blume-q1-q2-q3-resolution.md
 *
 * The Artifact is BLUME's atomic unit. The Router-Tag is the metadata envelope
 * that travels with it across the BLUME-MCP ↔ Terravian-MCP boundary.
 */

export type ArtifactSource =
  | "blume-generated"
  | "manual"
  | "imported"
  | "published"          // publish INTENT (approved/queued) — NOT evidence of real publication
  | "publish-confirmed"  // CONFIRMED external publication — Proof-of-Use evidence
  | "system";

export const ARTIFACT_SOURCES: readonly ArtifactSource[] = [
  "blume-generated",
  "manual",
  "imported",
  "published",
  "publish-confirmed",
  "system",
];

export type VaultTier = "core" | "extended" | "sovereign";

export interface VaultRegistryEntry {
  slug: string;          // canonical key (e.g. "brand-assets")
  doctrine_no: number;   // 1..12 (doctrine order)
  display: string;       // "Brand Assets"
  tier: VaultTier;
  legacy_int: number | null;  // old code 1..8 (compat only)
  active: boolean;       // compliance(10) is parked = false
}

/** Router-Tag = the MCP-boundary contract (the artifact minus its payload). */
export interface RouterTag {
  uuid: string;
  brand: string;                  // brand slug (FK)
  vault: string;                  // canonical vault SLUG (not the legacy integer)
  switch: number | null;          // Sales Switch 1..7, or null
  title: string;
  timestamp: string;              // ISO-8601, immutable creation time
  version: number;                // >= 1
  source: ArtifactSource;
  hash: string;                   // sha256 of canonical body
  metadata: Record<string, unknown>;
}

/** Artifact = Router-Tag + payload + version lineage + updated_at. */
export interface Artifact extends RouterTag {
  body: string | null;            // inline content
  ref: string | null;             // pointer (storage url) when not inline
  parent_uuid: string | null;     // null = original; else the lineage root
  updated_at: string;
}

export interface IngestInput {
  brand: string;
  title: string;
  body?: string;
  ref?: string;
  vault?: string;                 // slug; default "creative-drafts"
  switch?: number | null;
  source?: ArtifactSource;        // default "manual"
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
