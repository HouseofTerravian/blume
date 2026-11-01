/**
 * Artifact Store (S1) — ingest, retrieve, list, version.
 * Dual storage: local JSON (primary, deterministic) + Supabase `thq_artifacts` (best-effort mirror),
 * mirroring the existing vault system pattern.
 * Spec: build/ARTIFACT_SPINE_SPEC_v1.md §6/§7.
 */

import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { computeHash, newUuid, toRouterTag, validateRouterTag } from "./routerTag.js";
import { DEFAULT_VAULT_SLUG } from "./registry.js";
import { isInstitutionalScope } from "./scope.js";

export const RAW_SIGNAL_KIND = "tpig.raw_signal";

function isRawSignal(a: { metadata?: Record<string, unknown> }): boolean {
  return a.metadata?.kind === RAW_SIGNAL_KIND;
}
import { isSupabaseEnabled, dbSaveArtifact, dbReadArtifacts, type DbArtifact } from "../integrations/supabase.js";
import type { Artifact, IngestInput, RouterTag, ArtifactSource } from "./types.js";

const DEFAULT_SOURCE = "manual" as const;

function artifactsRoot(): string {
  return path.join(config.vault.root, "_artifacts");
}
function brandDir(brand: string): string {
  return path.join(artifactsRoot(), brand);
}
function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Persist an artifact: local JSON primary (durable) + Supabase live mirror.
 * **Read-after-write:** when Supabase is enabled, this AWAITS the mirror and THROWS if it fails —
 * so ingest does not report success until the row is in live `thq_artifacts`. The local copy is
 * written first and preserved regardless. When Supabase is disabled, local-only (fallback preserved).
 */
/** The local write-once file could not be written. Same message as the underlying error; typed so callers can classify it. */
export class ArtifactWriteError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "artifact local write failed");
    this.name = "ArtifactWriteError";
    (this as { cause?: unknown }).cause = cause;
  }
}

/** The live thq_artifacts mirror did not succeed (the local copy was preserved). */
export class ArtifactMirrorError extends Error {
  constructor(uuid: string) {
    super(`artifact mirror failed: write to live thq_artifacts did not succeed (uuid=${uuid}). Local copy preserved.`);
    this.name = "ArtifactMirrorError";
  }
}

export async function persistArtifact(a: Artifact): Promise<void> {
  const dir = brandDir(a.brand);
  // Raw signals are write-once: exclusive-create locally, insert-only in Supabase.
  const immutable = isRawSignal(a);
  try {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, `${a.uuid}.json`), JSON.stringify(a, null, 2), {
      encoding: "utf-8",
      flag: immutable ? "wx" : "w",
    });
  } catch (err) {
    throw new ArtifactWriteError(err);
  }
  if (isSupabaseEnabled()) {
    const saved = await dbSaveArtifact(a, { insertOnly: immutable });
    if (saved === null) throw new ArtifactMirrorError(a.uuid);
  }
}

/** Ingest: validate → assign uuid/timestamp/version/hash/source → store (awaits live mirror). */
export async function ingestArtifact(
  input: IngestInput,
  opts?: { institutional?: boolean },
): Promise<{ artifact: Artifact; routerTag: RouterTag }> {
  if (!input.brand || typeof input.brand !== "string") {
    throw new Error("ingest: 'brand' (slug) is required");
  }
  if (!input.title || typeof input.title !== "string") {
    throw new Error("ingest: 'title' is required");
  }
  if (isInstitutionalScope(input.brand) && !opts?.institutional) {
    throw new Error(`ingest: "${input.brand}" is a reserved institutional scope; it cannot be written through this path`);
  }
  if (input.metadata?.kind === RAW_SIGNAL_KIND && !opts?.institutional) {
    throw new Error(`ingest: metadata.kind "${RAW_SIGNAL_KIND}" is reserved for the signal envelope writer`);
  }

  const now = new Date().toISOString();
  const body = input.body ?? null;

  const artifact: Artifact = {
    uuid: newUuid(),
    brand: input.brand,
    vault: input.vault ?? DEFAULT_VAULT_SLUG,
    switch: input.switch ?? null,
    title: input.title,
    timestamp: now,
    version: 1,
    source: input.source ?? DEFAULT_SOURCE,
    hash: computeHash(body),
    metadata: input.metadata ?? {},
    body,
    ref: input.ref ?? null,
    parent_uuid: null,
    updated_at: now,
  };

  const result = validateRouterTag(toRouterTag(artifact), { body });
  if (!result.valid) {
    throw new Error(`ingest: invalid router-tag — ${result.errors.join("; ")}`);
  }

  await persistArtifact(artifact);
  return { artifact, routerTag: toRouterTag(artifact) };
}

/** Fetch one artifact by uuid (searches the given brand, or scans all brands). */
export function getArtifact(uuid: string, brand?: string): Artifact | null {
  const tryPath = (b: string): Artifact | null => {
    const p = path.join(brandDir(b), `${uuid}.json`);
    if (!fs.existsSync(p)) return null;
    const a = JSON.parse(fs.readFileSync(p, "utf-8")) as Artifact;
    if (isRawSignal(a) && computeHash(a.body) !== a.hash) {
      throw new Error(`integrity: raw signal ${a.uuid} body does not match its recorded hash`);
    }
    return a;
  };
  if (brand) return tryPath(brand);

  const root = artifactsRoot();
  if (!fs.existsSync(root)) return null;
  for (const b of fs.readdirSync(root)) {
    const found = tryPath(b);
    if (found) return found;
  }
  return null;
}

interface ListFilters { brand: string; vault?: string; switch?: number | null; limit?: number }

/** Local-only read (sync) — the offline/dev path and the fallback for the live read. */
function listArtifactsLocal(filters: ListFilters): Artifact[] {
  const dir = brandDir(filters.brand);
  if (!fs.existsSync(dir)) return [];

  let arts = fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Artifact);

  if (filters.vault) arts = arts.filter(a => a.vault === filters.vault);
  if (filters.switch !== undefined && filters.switch !== null) {
    arts = arts.filter(a => a.switch === filters.switch);
  }

  arts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return filters.limit ? arts.slice(0, filters.limit) : arts;
}

/** Map a live `thq_artifacts` row to the canonical Artifact shape. */
function dbToArtifact(r: DbArtifact): Artifact {
  return {
    uuid: r.uuid,
    brand: r.brand,
    vault: r.vault,
    switch: r.switch,
    title: r.title,
    timestamp: r.timestamp,
    version: r.version,
    source: r.source as ArtifactSource,
    hash: r.hash,
    metadata: r.metadata ?? {},
    body: r.body,
    ref: r.ref,
    parent_uuid: r.parent_uuid,
    updated_at: r.updated_at,
  };
}

/**
 * List artifacts by brand, optionally filtered by vault slug and/or switch — the call Lotus needs.
 *
 * **Supabase-first, local fallback.** When Supabase is enabled, reads live `thq_artifacts`
 * (so a fresh process scores true live data without the local JSON store). On a Supabase read
 * error it falls back to local; when Supabase is disabled it reads local (offline/dev). Lotus and
 * Recommendation depend on THIS boundary — they never query Supabase directly.
 */
export async function listArtifacts(filters: ListFilters): Promise<Artifact[]> {
  if (isSupabaseEnabled()) {
    const rows = await dbReadArtifacts(filters);
    if (rows !== null) return rows.map(dbToArtifact);   // live read
    // rows === null → Supabase error → fall through to local fallback
  }
  return listArtifactsLocal(filters);
}

/** Append an immutable new version; original stays intact, lineage preserved. */
export async function versionArtifact(
  uuid: string,
  body: string,
  metadata?: Record<string, unknown>,
): Promise<Artifact> {
  const orig = getArtifact(uuid);
  if (!orig) throw new Error(`version: artifact not found: ${uuid}`);
  if (isRawSignal(orig)) throw new Error("version: raw signals are immutable and cannot be versioned");

  const lineageRoot = orig.parent_uuid ?? orig.uuid;
  const lineage = listArtifactsLocal({ brand: orig.brand }).filter(
    a => (a.parent_uuid ?? a.uuid) === lineageRoot,
  );
  const maxVersion = lineage.reduce((m, a) => Math.max(m, a.version), orig.version);

  const now = new Date().toISOString();
  const next: Artifact = {
    ...orig,
    uuid: newUuid(),
    version: maxVersion + 1,
    parent_uuid: lineageRoot,
    body,
    hash: computeHash(body),
    metadata: metadata ?? orig.metadata,
    timestamp: now,
    updated_at: now,
  };

  await persistArtifact(next);
  return next;
}
