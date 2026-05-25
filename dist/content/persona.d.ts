import type { BrandProfile } from "../brands/types.js";
export type BlumeMode = "collaborative" | "dominion_rex" | "venus_protocol" | "commerce" | "insight" | "grace";
export interface PostRequest {
    brand: string;
    platform: "twitter" | "instagram" | "linkedin" | "facebook" | "tiktok" | "youtube";
    goal: "awareness" | "engagement" | "conversion" | "retention" | "launch";
    aidaStage?: "attention" | "interest" | "desire" | "action";
    mode?: BlumeMode;
    topic?: string;
    humanLoop?: boolean;
}
export interface GeneratedPost {
    brand: string;
    platform: string;
    mode: BlumeMode;
    aidaStage: string;
    content: string;
    characterCount: number;
    approved: boolean;
    scheduledAt?: string;
    postedAt?: string;
    postId?: string;
}
export declare function getBlumeSystemPrompt(mode: BlumeMode, brand: BrandProfile): string;
export declare const PLATFORM_LIMITS: Record<string, number>;
//# sourceMappingURL=persona.d.ts.map