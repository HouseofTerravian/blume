/**
 * Supabase Integration — BLUME scope only.
 * Covers: vault entries, festivals, and minimal op task creation
 * for chaining pipeline stages. Scheduler daemon stays in terravian-mcp.
 */
import { createClient } from "@supabase/supabase-js";
let _client = null;
export function getSupabase() {
    if (_client)
        return _client;
    const url = process.env.SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
    if (!url || !key)
        return null;
    _client = createClient(url, key);
    return _client;
}
export function isSupabaseEnabled() {
    return getSupabase() !== null;
}
export async function dbSaveVaultEntry(entry) {
    const sb = getSupabase();
    if (!sb)
        return null;
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
export async function dbReadVault(brand, vault) {
    const sb = getSupabase();
    if (!sb)
        return [];
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
export async function dbGetVaultSummary(brand) {
    const sb = getSupabase();
    if (!sb)
        return {};
    const summary = {};
    for (let v = 1; v <= 8; v++) {
        const { count, error } = await sb
            .from("thq_vault_entries")
            .select("*", { count: "exact", head: true })
            .eq("brand", brand)
            .eq("vault", v);
        if (!error)
            summary[`vault-${v}`] = count ?? 0;
    }
    return summary;
}
export async function dbCreateTask(input) {
    const sb = getSupabase();
    if (!sb)
        return null;
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
    return data;
}
// ─── Event Emission (pipeline notifications only) ────────────────────────────
export async function dbEmitEvent(event_name, payload, opts = {}) {
    const sb = getSupabase();
    if (!sb)
        return;
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
export async function dbInsertFestivals(festivals) {
    const sb = getSupabase();
    if (!sb)
        return [];
    const { data, error } = await sb
        .from("thq_festivals")
        .insert(festivals)
        .select();
    if (error) {
        console.error("[Supabase] Insert festivals error:", error.message);
        return [];
    }
    return (data ?? []);
}
export async function dbGetBatchFestivals(batch_id) {
    const sb = getSupabase();
    if (!sb)
        return [];
    const { data, error } = await sb
        .from("thq_festivals")
        .select("*")
        .eq("batch_id", batch_id);
    if (error)
        return [];
    return (data ?? []);
}
export async function dbFindDuplicate(name, city) {
    const sb = getSupabase();
    if (!sb)
        return null;
    const { data } = await sb
        .from("thq_festivals")
        .select("*")
        .ilike("name", name)
        .ilike("city", city)
        .neq("status", "duplicate")
        .neq("status", "rejected")
        .limit(1)
        .single();
    return data;
}
export async function dbUpdateFestivalStatus(id, status) {
    const sb = getSupabase();
    if (!sb)
        return false;
    const { error } = await sb
        .from("thq_festivals")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
    return !error;
}
export async function dbUpdateBatchStatus(batch_id, from_status, to_status) {
    const sb = getSupabase();
    if (!sb)
        return 0;
    const { data, error } = await sb
        .from("thq_festivals")
        .update({ status: to_status, updated_at: new Date().toISOString() })
        .eq("batch_id", batch_id)
        .eq("status", from_status)
        .select("id");
    if (error)
        return 0;
    return (data ?? []).length;
}
export async function dbGetFestivalById(id) {
    const sb = getSupabase();
    if (!sb)
        return null;
    const { data, error } = await sb
        .from("thq_festivals")
        .select("*")
        .eq("id", id)
        .single();
    if (error || !data)
        return null;
    return data;
}
export async function dbUpdateFestivalSEO(id, seoContent) {
    const sb = getSupabase();
    if (!sb)
        return false;
    const { error } = await sb
        .from("thq_festivals")
        .update({ seo_content: seoContent, status: "seo_generated", updated_at: new Date().toISOString() })
        .eq("id", id);
    return !error;
}
export async function dbListFestivals(filters) {
    const sb = getSupabase();
    if (!sb)
        return [];
    let query = sb.from("thq_festivals").select("*");
    if (filters.city)
        query = query.ilike("city", filters.city);
    if (filters.state)
        query = query.ilike("state", filters.state);
    if (filters.category)
        query = query.eq("category", filters.category);
    if (filters.status)
        query = query.eq("status", filters.status);
    if (filters.brand)
        query = query.eq("brand", filters.brand);
    if (filters.batch_id)
        query = query.eq("batch_id", filters.batch_id);
    const { data, error } = await query
        .order("start_date", { ascending: true })
        .limit(filters.limit ?? 50);
    if (error)
        return [];
    return (data ?? []);
}
//# sourceMappingURL=supabase.js.map