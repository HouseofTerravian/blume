/**
 * FestivalCalendar.online — 4-stage pipeline
 *
 * Stage 1 — ingest:        normalize + insert → create dedup task
 * Stage 2 — dedup:         mark duplicates → create seo_page_generate tasks
 * Stage 3 — seo_generate:  BLUME insight mode → SEO content → update festival
 * Stage 4 — publish:       set published → log to Vault 1 → emit festival_published
 *
 * Each stage chains the next via dbCreateTask (writes to thq_op_queue).
 * The daemon in terravian-mcp picks up and executes queued tasks.
 */
import type { FestivalInput } from "./types.js";
export declare function ingestFestivals(payload: {
    festivals: FestivalInput[];
    brand?: string;
    source?: string;
    batch_id?: string;
    workflow_id?: string;
    triggered_by?: string;
}): Promise<{
    ingested: number;
    skipped: number;
    batch_id: string;
}>;
export declare function dedupFestivalBatch(payload: {
    batch_id: string;
    brand?: string;
    workflow_id?: string;
    triggered_by?: string;
}): Promise<{
    checked: number;
    unique: number;
    duplicates: number;
    batch_id: string;
}>;
export declare function generateFestivalPageSEO(payload: {
    festival_id: string;
    batch_id?: string;
    brand?: string;
    workflow_id?: string;
    triggered_by?: string;
}): Promise<{
    festival_id: string;
    festival_name: string;
    seo_generated: boolean;
    confidence: string;
    needs_review: boolean;
}>;
export declare function publishFestival(payload: {
    festival_id?: string;
    batch_id?: string;
    brand?: string;
    workflow_id?: string;
}): Promise<{
    published: number;
    festival_id?: string;
    festival_name?: string;
    batch_id?: string;
}>;
//# sourceMappingURL=pipeline.d.ts.map