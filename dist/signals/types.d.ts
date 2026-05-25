export type SourceType = "serp" | "google_events" | "google_maps" | "youtube" | "news" | "manual";
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
//# sourceMappingURL=types.d.ts.map