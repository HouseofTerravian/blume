/**
 * Bridge: BLUME generation → Artifact Spine (S1) so Lotus runs live.
 *
 * Drafts → Creative Drafts (source: blume-generated).
 * Published → Published Works (source: published).
 * NEVER throws — generation behavior is preserved even if ingest fails.
 */

import { ingestArtifact } from "../artifacts/store.js";
import type { Artifact } from "../artifacts/types.js";

export async function ingestGenerated(input: {
  brand: string;
  title: string;
  body: string;
  kind: string;                 // post | aida | offer | email | seo | page
  published?: boolean;          // true → Published Works; else Creative Drafts
  switch?: number | null;       // Sales Switch the content serves
  metadata?: Record<string, unknown>;
}): Promise<Artifact | null> {
  try {
    const published = input.published === true;
    const { artifact } = await ingestArtifact({
      brand: input.brand,
      title: input.title,
      body: input.body,
      vault: published ? "published-works" : "creative-drafts",
      source: published ? "published" : "blume-generated",
      switch: input.switch ?? null,
      metadata: { kind: input.kind, generated: true, ...input.metadata },
    });
    return artifact;
  } catch (err) {
    // Auto-ingest is best-effort; generation output must not break.
    console.error("[Artifacts] auto-ingest skipped (generation preserved):", (err as Error).message);
    return null;
  }
}

/** Map a post goal to the Sales Switch it primarily serves (for richer Lotus signal). */
export function goalToSwitch(goal: string): number | null {
  switch (goal) {
    case "awareness":  return 3; // Traffic
    case "engagement": return 2; // Audience
    case "conversion": return 5; // Conversion
    case "retention":  return 6; // Retention
    case "launch":     return 7; // Scaling
    default:           return null;
  }
}
