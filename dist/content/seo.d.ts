/**
 * SEO content generation — BLUME insight mode.
 * Festival-specific SEO and general brand SEO.
 */
export interface SEOContent {
    meta_title: string;
    meta_description: string;
    h1: string;
    intro: string;
    social_posts: Array<{
        platform: string;
        content: string;
    }>;
    confidence: "high" | "medium" | "low";
}
export declare function generateFestivalSEO(festival: {
    name: string;
    city: string;
    state?: string | null;
    category: string;
    description?: string | null;
    website?: string | null;
    start_date?: string | null;
    end_date?: string | null;
}): Promise<SEOContent>;
export declare function generateSEOContent(input: {
    brand: string;
    topic: string;
    url?: string;
}): Promise<SEOContent>;
//# sourceMappingURL=seo.d.ts.map