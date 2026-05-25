/**
 * Supabase Integration — BLUME scope only.
 * Covers: vault entries, festivals, and minimal op task creation
 * for chaining pipeline stages. Scheduler daemon stays in terravian-mcp.
 */
import { SupabaseClient } from "@supabase/supabase-js";
export declare function getSupabase(): SupabaseClient | null;
export declare function isSupabaseEnabled(): boolean;
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
export declare function dbSaveVaultEntry(entry: DbVaultEntry): Promise<DbVaultEntry | null>;
export declare function dbReadVault(brand: string, vault: number): Promise<DbVaultEntry[]>;
export declare function dbGetVaultSummary(brand: string): Promise<Record<string, number>>;
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
export declare function dbCreateTask(input: CreateTaskInput): Promise<OpTask | null>;
export declare function dbEmitEvent(event_name: string, payload: Record<string, unknown>, opts?: {
    brand?: string;
    source?: string;
    workflow_id?: string;
}): Promise<void>;
import type { FestivalRecord, FestivalFilters } from "../listings/festivals/types.js";
export declare function dbInsertFestivals(festivals: Omit<FestivalRecord, "id" | "created_at" | "updated_at">[]): Promise<FestivalRecord[]>;
export declare function dbGetBatchFestivals(batch_id: string): Promise<FestivalRecord[]>;
export declare function dbFindDuplicate(name: string, city: string): Promise<FestivalRecord | null>;
export declare function dbUpdateFestivalStatus(id: string, status: string): Promise<boolean>;
export declare function dbUpdateBatchStatus(batch_id: string, from_status: string, to_status: string): Promise<number>;
export declare function dbGetFestivalById(id: string): Promise<FestivalRecord | null>;
export declare function dbUpdateFestivalSEO(id: string, seoContent: Record<string, unknown>): Promise<boolean>;
export declare function dbListFestivals(filters: FestivalFilters): Promise<FestivalRecord[]>;
//# sourceMappingURL=supabase.d.ts.map