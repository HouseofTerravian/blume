/**
 * Proof-of-Use — evidentiary infrastructure (NOT activity logging).
 *
 * Answers "what has actually happened in reality?" — only CONFIRMED publication qualifies.
 * Drafts / generated / scheduled / queued / intent are NOT proof. The single gate is the
 * presence of an `external_post_id` returned by a platform after a successful publish.
 *
 * Emits one `proof-of-use` artifact (source `publish-confirmed`) through the existing spine,
 * so it inherits: router-tag, sha256 content hash, version lineage, live Supabase mirror
 * (read-after-write) + local fallback. No changes to Lotus, Recommendation, taxonomy, or doctrine.
 */

import { ingestArtifact } from "../artifacts/store.js";
import { computeHash } from "../artifacts/routerTag.js";
import type { Artifact } from "../artifacts/types.js";

export interface PublishConfirmation {
  brand: string;
  platform: string;
  external_post_id: string;   // REQUIRED — the platform's confirmation that the post is live
  content: string;            // the published content (hashed → content_hash = artifact.hash)
  external_url?: string;
  posting_account?: string;
  published_at?: string;      // ISO-8601; defaults to now
}

/**
 * Record durable evidence of a real-world publication.
 * Returns `null` (no artifact) when there is no `external_post_id` — i.e. intent ≠ proof.
 * When emitted, AWAITS the live mirror (read-after-write) so the evidence is immediately
 * visible to Lotus via the Supabase read path. Throws if the durable write fails.
 */
export async function recordProofOfUse(c: PublishConfirmation): Promise<Artifact | null> {
  if (!c.external_post_id) return null;   // no platform confirmation → not proof

  const published_at = c.published_at ?? new Date().toISOString();
  const content_hash = computeHash(c.content);   // == artifact.hash (sha256 of body)

  const { artifact } = await ingestArtifact({
    brand: c.brand,
    title: `Published · ${c.platform} · ${c.external_post_id}`,
    body: c.content,
    vault: "proof-of-use",
    source: "publish-confirmed",
    metadata: {
      platform: c.platform,
      external_post_id: c.external_post_id,
      external_url: c.external_url ?? null,
      published_at,
      posting_account: c.posting_account ?? null,
      content_hash,
    },
  });

  return artifact;
}
