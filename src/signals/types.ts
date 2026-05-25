// Signal Intake Engine — Phase 2
// Accepts raw signals from external sources (SERP, Google Events, Maps, YouTube, News).

export type SourceType =
  | "serp"           // SERP API results
  | "google_events"  // Google Events data
  | "google_maps"    // Google Maps / local results
  | "youtube"        // YouTube search results
  | "news"           // News API
  | "manual";        // Manually provided

export interface SignalInput {
  source: SourceType;
  keyword: string;
  location?: string;
  brand: string;
  vertical: string;
  raw?: Record<string, unknown>;
}

export interface SignalResult {
  id: string;
  source: SourceType;
  keyword: string;
  location?: string;
  brand: string;
  vertical: string;
  data: Record<string, unknown>;
  ingested_at: string;
}
