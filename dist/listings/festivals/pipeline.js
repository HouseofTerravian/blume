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
import { randomUUID } from "crypto";
import { generateFestivalSEO } from "./seo.js";
import { saveToVault } from "../../vault/index.js";
import { dbInsertFestivals, dbGetBatchFestivals, dbGetFestivalById, dbFindDuplicate, dbUpdateFestivalStatus, dbUpdateFestivalSEO, dbUpdateBatchStatus, dbCreateTask, dbEmitEvent, } from "../../integrations/supabase.js";
function makeSlug(name, city) {
    return `${name}-${city}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
// ─── Stage 1: Ingest ──────────────────────────────────────────────────────────
export async function ingestFestivals(payload) {
    const { festivals, brand, source, workflow_id, triggered_by } = payload;
    if (!Array.isArray(festivals) || festivals.length === 0) {
        throw new Error("ingestFestivals requires a non-empty festivals array.");
    }
    const batch_id = payload.batch_id ?? randomUUID();
    const rows = festivals.map(f => ({
        name: f.name,
        slug: makeSlug(f.name, f.city),
        city: f.city,
        state: f.state ?? null,
        country: f.country ?? "US",
        category: f.category,
        start_date: f.start_date ?? null,
        end_date: f.end_date ?? null,
        description: f.description ?? null,
        website: f.website ?? null,
        ticket_url: f.ticket_url ?? null,
        featured: f.featured ?? false,
        status: "pending",
        batch_id,
        source: source ?? "blume",
        brand: brand ?? null,
        seo_content: null,
    }));
    const inserted = await dbInsertFestivals(rows);
    await dbEmitEvent("festival_ingested", { batch_id, count: inserted.length, brand: brand ?? "festivalcalendar" }, { brand: brand ?? "festivalcalendar", source: "blume", workflow_id });
    await dbCreateTask({
        brand: brand ?? "festivalcalendar",
        task_type: "festival_dedup",
        payload: { batch_id, brand },
        priority: 3,
        workflow_id,
        triggered_by,
    });
    return { ingested: inserted.length, skipped: festivals.length - inserted.length, batch_id };
}
// ─── Stage 2: Dedup ───────────────────────────────────────────────────────────
export async function dedupFestivalBatch(payload) {
    const { batch_id, brand, workflow_id, triggered_by } = payload;
    if (!batch_id)
        throw new Error("dedupFestivalBatch requires batch_id.");
    const batch = await dbGetBatchFestivals(batch_id);
    const pending = batch.filter(f => f.status === "pending");
    let duplicates = 0;
    const uniqueIds = [];
    for (const festival of pending) {
        const existing = await dbFindDuplicate(festival.name, festival.city);
        if (existing && existing.id !== festival.id) {
            await dbUpdateFestivalStatus(festival.id, "duplicate");
            duplicates++;
        }
        else {
            await dbUpdateFestivalStatus(festival.id, "dedup_checked");
            uniqueIds.push(festival.id);
        }
    }
    for (const festival_id of uniqueIds) {
        await dbCreateTask({
            brand: brand ?? "festivalcalendar",
            task_type: "seo_page_generate",
            payload: { festival_id, batch_id, brand },
            priority: 3,
            workflow_id,
            triggered_by,
        });
    }
    return { checked: pending.length, unique: uniqueIds.length, duplicates, batch_id };
}
// ─── Stage 3: SEO Generate ────────────────────────────────────────────────────
export async function generateFestivalPageSEO(payload) {
    const { festival_id, batch_id, brand, workflow_id, triggered_by } = payload;
    if (!festival_id)
        throw new Error("generateFestivalPageSEO requires festival_id.");
    const festival = await dbGetFestivalById(festival_id);
    if (!festival)
        throw new Error(`Festival ${festival_id} not found.`);
    let seo = festival.seo_content;
    if (!seo) {
        seo = await generateFestivalSEO({
            name: festival.name,
            city: festival.city,
            state: festival.state,
            category: festival.category,
            description: festival.description,
            website: festival.website,
            start_date: festival.start_date,
            end_date: festival.end_date,
        });
        await dbUpdateFestivalSEO(festival_id, seo);
    }
    const confidence = String(seo.confidence ?? "medium");
    await dbCreateTask({
        brand: brand ?? "festivalcalendar",
        task_type: "festival_publish",
        payload: { festival_id, batch_id, brand },
        priority: 5,
        workflow_id,
        triggered_by,
    });
    return {
        festival_id,
        festival_name: festival.name,
        seo_generated: true,
        confidence,
        needs_review: confidence === "low",
    };
}
// ─── Stage 4: Publish ─────────────────────────────────────────────────────────
export async function publishFestival(payload) {
    const { festival_id, batch_id, brand, workflow_id } = payload;
    if (festival_id) {
        const festival = await dbGetFestivalById(festival_id);
        if (!festival)
            throw new Error(`Festival ${festival_id} not found.`);
        await dbUpdateFestivalStatus(festival_id, "published");
        const effectiveBrand = brand ?? festival.brand ?? "festivalcalendar";
        saveToVault(effectiveBrand, 1, {
            vault: 1,
            brand: effectiveBrand,
            title: `Festival Published: ${festival.name} — ${festival.city}`,
            content: `${festival.name} published to FestivalCalendar.online.\nCategory: ${festival.category}\nLocation: ${festival.city}${festival.state ? `, ${festival.state}` : ""}${festival.start_date ? `\nDate: ${festival.start_date}` : ""}${festival.website ? `\nWebsite: ${festival.website}` : ""}`,
            tags: ["festival", "published", festival.category.toLowerCase(), festival.city.toLowerCase()],
            metadata: { festival_id, batch_id: batch_id ?? null },
        });
        await dbEmitEvent("festival_published", { festival_id, festival_name: festival.name, city: festival.city, category: festival.category, batch_id: batch_id ?? null }, { brand: effectiveBrand, source: "blume", workflow_id });
        return { published: 1, festival_id, festival_name: festival.name };
    }
    if (batch_id) {
        const published = await dbUpdateBatchStatus(batch_id, "seo_generated", "published");
        return { published, batch_id };
    }
    throw new Error("publishFestival requires festival_id or batch_id.");
}
//# sourceMappingURL=pipeline.js.map