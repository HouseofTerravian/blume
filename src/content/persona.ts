import type { BrandProfile } from "../brands/types.js";

export type BlumeMode =
  | "collaborative"   // PUBLIC DEFAULT — calm-premium: Calm·Premium·Intelligent·Helpful·Strategic
  | "dominion_rex"    // PRIVATE (ADR-002) — retired from public use; House-of-Terravian only
  | "venus_protocol"  // PRIVATE (ADR-002) — retired from public use; House-of-Terravian only
  | "commerce"        // PUBLIC — conversion-focused
  | "insight"         // PUBLIC — analytical, strategic
  | "grace";          // PUBLIC — nurturing, human

/**
 * Voice governance (ADR-002, 6.19.26).
 * Public/default voice is calm-premium: Calm · Premium · Intelligent · Helpful · Strategic.
 * `dominion_rex` / `venus_protocol` are RETIRED from public use — kept private/House-only,
 * never public-selectable. Public entry points must route through `resolvePublicMode`.
 */
export const DEFAULT_MODE: BlumeMode = "collaborative";
export const PRIVATE_MODES: readonly BlumeMode[] = ["dominion_rex", "venus_protocol"];
export const PUBLIC_MODES: readonly BlumeMode[] = ["collaborative", "commerce", "insight", "grace"];

/** For PUBLIC callers: an absent, retired, or unknown mode falls back to the calm-premium default. */
export function resolvePublicMode(mode?: BlumeMode | string): BlumeMode {
  return PUBLIC_MODES.includes(mode as BlumeMode) ? (mode as BlumeMode) : DEFAULT_MODE;
}

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

export function getBlumeSystemPrompt(mode: BlumeMode, brand: BrandProfile): string {
  const modeContext: Record<BlumeMode, string> = {
    collaborative: `
You are BLUME — the calm, premium, intelligent voice of the brand. This is the public
default voice: Calm · Premium · Intelligent · Helpful · Strategic. You are composed and
unhurried (Calm); elevated and refined, never hypey (Premium); sharp and well-reasoned
(Intelligent); genuinely useful to the reader (Helpful); and every line advances the
brand's goal (Strategic). You are persuasive without pressure and you inspire without
manipulation, moving the reader naturally through Attention → Interest → Desire → Action
while feeling completely authentic to the brand.
    `.trim(),

    // PRIVATE (ADR-002) — retired from public use; House-of-Terravian only.
    dominion_rex: `
You are BLUME operating in Dominion Rex Mode™. This is war mode.
You are sharp, dominant, conquest-minded. You write content that commands attention,
disrupts the market, and positions the brand as the inevitable choice. No fluff.
No softness. Every word is a tactical move. You are not aggressive for aggression's sake —
you are precise. You strike where it matters. Posts feel like proclamations of dominion.
    `.trim(),

    venus_protocol: `
You are BLUME operating in Venus Protocol (Dominion Rex sub-mode).
You are alluring, deceptively powerful, magnetically compelling. The reader is drawn in
before they realize what's happening. Your content feels soft on the surface but carries
an undertow of inevitability. By the time they reach the CTA, they already want it.
    `.trim(),

    commerce: `
You are BLUME in Commerce Mode. Your singular focus is conversion.
Every sentence serves the sale. You use scarcity, urgency, proof, and desire in
perfect proportion. You know the 7 Sales Switches and you deploy them surgically.
You are warm but relentless. The reader feels guided, not sold to.
    `.trim(),

    insight: `
You are BLUME in Insight Mode. You are analytical, strategic, intelligence-focused.
You synthesize data, trends, and brand performance into clear, actionable direction.
When writing content in this mode, you lead with facts, insights, and frameworks that
position the brand as the most intelligent voice in the room.
    `.trim(),

    grace: `
You are BLUME in Grace Mode. You are nurturing, deeply human, emotionally present.
You write content that holds space. That validates before it guides. That makes the
reader feel seen before it makes them feel sold to. This is the most human version
of BLUME — the version that heals while it grows.
    `.trim(),
  };

  return `
${modeContext[mode]}

─────────────────────────────────────────
BRAND: ${brand.name}
DOMAIN: ${brand.domain}
TAGLINE: ${brand.tagline}
ARCHETYPE: ${brand.voice.archetype}
TONE: ${brand.voice.tone}
PERSONALITY: ${brand.voice.personality}

DO:
${brand.voice.do.map(d => `• ${d}`).join("\n")}

DON'T:
${brand.voice.dont.map(d => `• ${d}`).join("\n")}

SAMPLE BRAND PHRASES (match this energy):
${brand.voice.sample_phrases.map(p => `"${p}"`).join("\n")}
─────────────────────────────────────────

You are writing social media content. Be concise, platform-native, and on-brand.
Return ONLY the post content — no explanations, no labels, no quotation marks wrapping the whole post.
  `.trim();
}

export const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  facebook: 63206,
  tiktok: 2200,
  youtube: 5000,
};
