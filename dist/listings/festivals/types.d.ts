export type FestivalCategory = "Music" | "Food" | "Art" | "Wellness" | "Cultural" | "Spiritual";
export type FestivalStatus = "pending" | "dedup_checked" | "seo_generated" | "published" | "duplicate" | "rejected";
export interface FestivalInput {
    name: string;
    city: string;
    state?: string;
    country?: string;
    category: FestivalCategory;
    start_date?: string;
    end_date?: string;
    description?: string;
    website?: string;
    ticket_url?: string;
    featured?: boolean;
}
export interface FestivalRecord {
    id: string;
    name: string;
    slug: string | null;
    city: string;
    state: string | null;
    country: string;
    category: string;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
    website: string | null;
    ticket_url: string | null;
    featured: boolean;
    status: FestivalStatus;
    batch_id: string | null;
    source: string | null;
    brand: string | null;
    seo_content: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}
export interface FestivalFilters {
    city?: string;
    state?: string;
    category?: FestivalCategory;
    status?: FestivalStatus;
    brand?: string;
    batch_id?: string;
    limit?: number;
}
export interface PipelineResult {
    batch_id: string;
    ingested: number;
    duplicates: number;
    published: number;
    skipped: number;
}
//# sourceMappingURL=types.d.ts.map