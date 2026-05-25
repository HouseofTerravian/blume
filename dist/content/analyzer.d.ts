export interface SiteAnalysis {
    url: string;
    title: string;
    description: string;
    headings: string[];
    bodyText: string;
    links: string[];
    analyzedAt: string;
}
export interface StrategicInsight {
    url: string;
    brand: string;
    summary: string;
    opportunities: string[];
    recommendedActions: string[];
    suggestedPosts: string[];
    analyzedAt: string;
}
export declare function scrapeSite(url: string): Promise<SiteAnalysis>;
export declare function analyzeSiteForBrand(url: string, brandSlug: string): Promise<StrategicInsight>;
//# sourceMappingURL=analyzer.d.ts.map