/**
 * Supabase Integration — BLUME scope only.
 * Covers: vault entries, festivals, and minimal op task creation
 * for chaining pipeline stages. Scheduler daemon stays in terravian-mcp.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  if (!url || !key) return null;

  _client = createClient(url, key);
  return _client;
}

export function isSupabaseEnabled(): boolean {
  return getSupabase() !== null;
}

// ─── Vault ───────────────────────────────────────────────────────────────────

export interface DbVaultEntry {
  id: string;
  brand: string;
  vault: number;
  vault_name: string;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function dbSaveVaultEntry(entry: DbVaultEntry): Promise<DbVaultEntry | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("thq_vault_entries")
    .upsert(entry)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Vault save error:", error.message);
    return null;
  }
  return data;
}

export async function dbReadVault(brand: string, vault: number): Promise<DbVaultEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("thq_vault_entries")
    .select("*")
    .eq("brand", brand)
    .eq("vault", vault)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Supabase] Vault read error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function dbGetVaultSummary(brand: string): Promise<Record<string, number>> {
  const sb = getSupabase();
  if (!sb) return {};

  const summary: Record<string, number> = {};
  for (let v = 1; v <= 12; v++) {
    const { count, error } = await sb
      .from("thq_vault_entries")
      .select("*", { count: "exact", head: true })
      .eq("brand", brand)
      .eq("vault", v);

    if (!error) summary[`vault-${v}`] = count ?? 0;
  }
  return summary;
}

// ─── Artifacts (Router-Tag Spine, thq_artifacts) ─────────────────────────────

export interface DbArtifact {
  uuid: string;
  brand: string;
  vault: string;                 // canonical slug
  switch: number | null;
  title: string;
  body: string | null;
  ref: string | null;
  source: string;
  version: number;
  parent_uuid: string | null;
  hash: string;
  timestamp: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export async function dbSaveArtifact(a: DbArtifact): Promise<DbArtifact | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("thq_artifacts")
    .upsert(a)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] Artifact save error:", error.message);
    return null;
  }
  return data as DbArtifact;
}

/**
 * Read artifacts from `thq_artifacts`. Returns `null` on error or when Supabase is unavailable,
 * so the artifact store can fall back to the local JSON store. (Empty result = `[]`, not null.)
 */
export async function dbReadArtifacts(filters: {
  brand: string;
  vault?: string;
  switch?: number | null;
  limit?: number;
}): Promise<DbArtifact[] | null> {
  const sb = getSupabase();
  if (!sb) return null;

  let query = sb.from("thq_artifacts").select("*").eq("brand", filters.brand);
  if (filters.vault) query = query.eq("vault", filters.vault);
  if (filters.switch !== undefined && filters.switch !== null) query = query.eq("switch", filters.switch);

  const { data, error } = await query
    .order("timestamp", { ascending: false })
    .limit(filters.limit ?? 500);

  if (error) {
    console.error("[Supabase] Artifact read error:", error.message);
    return null;
  }
  return (data ?? []) as DbArtifact[];
}

/** Same as dbReadArtifacts but never null ([] on error/unavailable) — for direct callers/tests. */
export async function dbListArtifacts(filters: {
  brand: string;
  vault?: string;
  switch?: number | null;
  limit?: number;
}): Promise<DbArtifact[]> {
  return (await dbReadArtifacts(filters)) ?? [];
}

// ─── Op Task Creation (pipeline chaining only) ───────────────────────────────

export interface CreateTaskInput {
  brand: string;
  task_type: string;
  payload?: Record<string, unknown>;
  priority?: number;
  max_attempts?: number;
  parent_id?: string;
  workflow_id?: string;
  triggered_by?: string;
}

export interface OpTask {
  id: string;
  brand: string;
  task_type: string;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  workflow_id?: string;
  triggered_by?: string;
  created_at: string;
}

export async function dbCreateTask(input: CreateTaskInput): Promise<OpTask | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("thq_op_queue")
    .insert({
      brand: input.brand,
      task_type: input.task_type,
      payload: input.payload ?? {},
      priority: input.priority ?? 5,
      max_attempts: input.max_attempts ?? 3,
      parent_id: input.parent_id ?? null,
      workflow_id: input.workflow_id ?? null,
      triggered_by: input.triggered_by ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[Supabase] Create task error:", error?.message);
    return null;
  }
  return data as OpTask;
}

// ─── Event Emission (pipeline notifications only) ────────────────────────────

export async function dbEmitEvent(
  event_name: string,
  payload: Record<string, unknown>,
  opts: { brand?: string; source?: string; workflow_id?: string } = {}
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb.from("thq_events").insert({
    event_name,
    payload,
    brand: opts.brand ?? null,
    source: opts.source ?? "blume",
    workflow_id: opts.workflow_id ?? null,
  });

  if (error) {
    console.error("[Supabase] Emit event error:", error.message);
  }
}

// ─── Festivals ────────────────────────────────────────────────────────────────

import type { FestivalRecord, FestivalFilters } from "../listings/festivals/types.js";

export async function dbInsertFestivals(
  festivals: Omit<FestivalRecord, "id" | "created_at" | "updated_at">[]
): Promise<FestivalRecord[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("thq_festivals")
    .insert(festivals)
    .select();

  if (error) {
    console.error("[Supabase] Insert festivals error:", error.message);
    return [];
  }
  return (data ?? []) as FestivalRecord[];
}

export async function dbGetBatchFestivals(batch_id: string): Promise<FestivalRecord[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("thq_festivals")
    .select("*")
    .eq("batch_id", batch_id);

  if (error) return [];
  return (data ?? []) as FestivalRecord[];
}

export async function dbFindDuplicate(name: string, city: string): Promise<FestivalRecord | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data } = await sb
    .from("thq_festivals")
    .select("*")
    .ilike("name", name)
    .ilike("city", city)
    .neq("status", "duplicate")
    .neq("status", "rejected")
    .limit(1)
    .single();

  return data as FestivalRecord | null;
}

export async function dbUpdateFestivalStatus(id: string, status: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("thq_festivals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  return !error;
}

export async function dbUpdateBatchStatus(
  batch_id: string,
  from_status: string,
  to_status: string
): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;

  const { data, error } = await sb
    .from("thq_festivals")
    .update({ status: to_status, updated_at: new Date().toISOString() })
    .eq("batch_id", batch_id)
    .eq("status", from_status)
    .select("id");

  if (error) return 0;
  return (data ?? []).length;
}

export async function dbGetFestivalById(id: string): Promise<FestivalRecord | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("thq_festivals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as FestivalRecord;
}

export async function dbUpdateFestivalSEO(
  id: string,
  seoContent: Record<string, unknown>
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("thq_festivals")
    .update({ seo_content: seoContent, status: "seo_generated", updated_at: new Date().toISOString() })
    .eq("id", id);

  return !error;
}

export async function dbListFestivals(filters: FestivalFilters): Promise<FestivalRecord[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let query = sb.from("thq_festivals").select("*");
  if (filters.city)     query = query.ilike("city", filters.city);
  if (filters.state)    query = query.ilike("state", filters.state);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status)   query = query.eq("status", filters.status);
  if (filters.brand)    query = query.eq("brand", filters.brand);
  if (filters.batch_id) query = query.eq("batch_id", filters.batch_id);

  const { data, error } = await query
    .order("start_date", { ascending: true })
    .limit(filters.limit ?? 50);

  if (error) return [];
  return (data ?? []) as FestivalRecord[];
}
