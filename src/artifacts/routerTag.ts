/**
 * Router-Tag contract — hashing, identity, and validation (S2).
 * Spec: build/ARTIFACT_SPINE_SPEC_v1.md §5.
 */

import { createHash, randomUUID } from "crypto";
import { ARTIFACT_SOURCES } from "./types.js";
import type { Artifact, RouterTag, ValidationResult, ArtifactSource } from "./types.js";
import { isValidVaultSlug } from "./registry.js";

/** Deterministic content hash. Same body → same hash (dedupe/integrity). */
export function computeHash(body: string | null | undefined): string {
  return createHash("sha256").update(body ?? "").digest("hex");
}

export function newUuid(): string {
  return randomUUID();
}

/** Extract the router-tag (the artifact minus its payload) — the MCP-boundary object. */
export function toRouterTag(a: Artifact): RouterTag {
  return {
    uuid: a.uuid,
    brand: a.brand,
    vault: a.vault,
    switch: a.switch,
    title: a.title,
    timestamp: a.timestamp,
    version: a.version,
    source: a.source,
    hash: a.hash,
    metadata: a.metadata,
  };
}

/**
 * Validate a router-tag against the contract.
 * Pass `{ body }` to additionally verify hash integrity against the payload.
 */
export function validateRouterTag(
  rt: Partial<RouterTag>,
  opts?: { body?: string | null },
): ValidationResult {
  const errors: string[] = [];

  const requireStr = (k: keyof RouterTag) => {
    if (typeof rt[k] !== "string" || !(rt[k] as string)) {
      errors.push(`Missing/invalid '${String(k)}' (non-empty string required)`);
    }
  };
  requireStr("uuid");
  requireStr("brand");
  requireStr("vault");
  requireStr("title");
  requireStr("timestamp");
  requireStr("source");
  requireStr("hash");

  if (typeof rt.version !== "number" || !Number.isInteger(rt.version) || rt.version < 1) {
    errors.push("'version' must be an integer >= 1");
  }

  if (!(rt.switch === null || rt.switch === undefined ||
        (typeof rt.switch === "number" && rt.switch >= 1 && rt.switch <= 7))) {
    errors.push("'switch' must be an integer 1..7 or null");
  }

  if (rt.source !== undefined && !ARTIFACT_SOURCES.includes(rt.source as ArtifactSource)) {
    errors.push(`'source' must be one of: ${ARTIFACT_SOURCES.join(", ")}`);
  }

  if (typeof rt.vault === "string" && !isValidVaultSlug(rt.vault)) {
    errors.push(`'vault' "${rt.vault}" is not in the vault registry`);
  }

  if (typeof rt.timestamp === "string") {
    const t = Date.parse(rt.timestamp);
    if (Number.isNaN(t)) errors.push("'timestamp' is not a valid ISO-8601 date");
    else if (t > Date.now() + 60_000) errors.push("'timestamp' must not be in the future");
  }

  if (rt.metadata !== undefined &&
      (typeof rt.metadata !== "object" || rt.metadata === null || Array.isArray(rt.metadata))) {
    errors.push("'metadata' must be an object");
  }

  if (opts && "body" in opts && typeof rt.hash === "string") {
    if (rt.hash !== computeHash(opts.body)) {
      errors.push("'hash' does not match the provided body");
    }
  }

  return { valid: errors.length === 0, errors };
}
