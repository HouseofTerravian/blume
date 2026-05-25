/**
 * BLUME Content Generator
 * Generates social posts, AIDA sequences, offers, and emails.
 * Does NOT post or schedule — that responsibility stays in terravian-mcp.
 */
import type { PostRequest, GeneratedPost, BlumeMode } from "./persona.js";
import { SEVEN_SWITCHES } from "./switches.js";
import type { SwitchNumber } from "./switches.js";
import { analyzeSiteForBrand } from "./analyzer.js";
export declare function generatePost(req: PostRequest): Promise<GeneratedPost>;
export declare function generateAIDASequence(brandSlug: string, platform: PostRequest["platform"], goal: PostRequest["goal"], mode?: BlumeMode, topic?: string): Promise<GeneratedPost[]>;
export declare function generateOffer(brandSlug: string, offerNum: number): Promise<{
    title: string;
    content: string;
}>;
export declare function generateEmail(brandSlug: string, sequenceType: string): Promise<{
    sequence: string;
    subject: string;
    body: string;
}>;
export declare function diagnoseBrand(brandSlug: string, context: string): Promise<{
    switchNumber: SwitchNumber;
    switch: (typeof SEVEN_SWITCHES)[SwitchNumber];
    advice: string;
}>;
export { analyzeSiteForBrand };
export type { PostRequest, GeneratedPost, BlumeMode };
//# sourceMappingURL=generator.d.ts.map