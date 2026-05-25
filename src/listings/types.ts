export type VerticalType =
  | "festival"
  | "apartment"       // Phase 2
  | "local_page"      // Phase 2
  | "creator_profile" // Phase 2
  | "job_listing";    // Phase 2

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
