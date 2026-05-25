export type VerticalType = "festival" | "apartment" | "local_page" | "creator_profile" | "job_listing";
export interface ListingInput {
    vertical: VerticalType;
    brand: string;
    source?: string;
    data: Record<string, unknown>;
}
export interface ListingRecord {
    id: string;
    vertical: VerticalType;
    brand: string;
    slug: string;
    name: string;
    city?: string;
    status: "pending" | "published" | "rejected";
    seo_content?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
//# sourceMappingURL=types.d.ts.map