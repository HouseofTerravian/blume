/**
 * BLUME Content Generator
 * Generates social posts, AIDA sequences, offers, and emails.
 * Does NOT post or schedule — that responsibility stays in terravian-mcp.
 */

import { think } from "../integrations/ai.js";
import { loadBrand } from "../brands/registry.js";
import { getBlumeSystemPrompt, PLATFORM_LIMITS, resolvePublicMode } from "./persona.js";
import type { PostRequest, GeneratedPost, BlumeMode } from "./persona.js";
import { SEVEN_SWITCHES, diagnoseSwitchFromContext } from "./switches.js";
import type { SwitchNumber } from "./switches.js";
import { analyzeSiteForBrand } from "./analyzer.js";
import { ingestGenerated, goalToSwitch } from "./ingestGenerated.js";

export async function generatePost(req: PostRequest): Promise<GeneratedPost> {
  const brand = loadBrand(req.brand);
  const mode: BlumeMode = resolvePublicMode(req.mode);  // retired/unknown → calm-premium default
  const aidaStage = req.aidaStage ?? "attention";

  const systemPrompt = getBlumeSystemPrompt(mode, brand);
  const platformLimit = PLATFORM_LIMITS[req.platform] ?? 280;

  const userMessage = `
Write a ${req.platform} post for ${brand.name}.

AIDA Stage: ${aidaStage.toUpperCase()}
Goal: ${req.goal}
Platform character limit: ${platformLimit}
${req.topic ? `Topic/direction: ${req.topic}` : ""}

AIDA guidance for this brand:
- Attention hook style: ${brand.aida.attention_hook}
- Interest approach: ${brand.aida.interest}
- Desire angle: ${brand.aida.desire}
- Action CTA: ${brand.aida.action}

Write ONLY the post content. No labels. No quotation marks around the whole post.
Stay under ${platformLimit} characters.
  `.trim();

  const content = await think(systemPrompt, userMessage, { fast: aidaStage === "attention" });
  const text = content.trim();

  // Auto-create an artifact so Lotus reflects this generation (drafts → Creative Drafts;
  // approved/immediate posts → Published Works). Best-effort; never breaks generation.
  ingestGenerated({
    brand: req.brand,
    title: `${req.platform} ${aidaStage} post — ${brand.name}`,
    body: text,
    kind: "post",
    published: req.humanLoop === false,
    switch: goalToSwitch(req.goal),
    metadata: { platform: req.platform, goal: req.goal, aidaStage, mode },
  });

  return {
    brand: req.brand,
    platform: req.platform,
    mode,
    aidaStage,
    content: text,
    characterCount: text.length,
    approved: !req.humanLoop,
  };
}

export async function generateAIDASequence(
  brandSlug: string,
  platform: PostRequest["platform"],
  goal: PostRequest["goal"],
  mode: BlumeMode = "collaborative",
  topic?: string
): Promise<GeneratedPost[]> {
  const stages: PostRequest["aidaStage"][] = ["attention", "interest", "desire", "action"];
  const posts: GeneratedPost[] = [];

  for (const stage of stages) {
    const post = await generatePost({
      brand: brandSlug,
      platform,
      goal,
      aidaStage: stage,
      mode,
      topic,
      humanLoop: true,
    });
    posts.push(post);
  }

  return posts;
}

export async function generateOffer(
  brandSlug: string,
  offerNum: number
): Promise<{ title: string; content: string }> {
  const brand = loadBrand(brandSlug);
  const systemPrompt = getBlumeSystemPrompt("commerce", brand);

  const userMessage = `
Create promotional offer #${offerNum} for ${brand.name} (${brand.domain}).
Brand tagline: "${brand.tagline}"

Write a short promotional offer that includes:
1. A compelling headline (under 60 chars)
2. The offer body (2-3 sentences max)
3. A clear CTA

Format as:
HEADLINE: ...
BODY: ...
CTA: ...

Be on-brand. No generic marketing speak.
  `.trim();

  const raw = (await think(systemPrompt, userMessage, { fast: true })).trim();
  const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
  const title = headlineMatch?.[1]?.trim() ?? `Offer #${offerNum}`;

  ingestGenerated({
    brand: brandSlug,
    title: `Offer — ${title}`,
    body: raw,
    kind: "offer",
    switch: 5, // Conversion
    metadata: { offerNum },
  });

  return { title, content: raw };
}

export async function generateEmail(
  brandSlug: string,
  sequenceType: string
): Promise<{ sequence: string; subject: string; body: string }> {
  const brand = loadBrand(brandSlug);
  const systemPrompt = getBlumeSystemPrompt("collaborative", brand);

  const userMessage = `
Write a ${sequenceType} email for ${brand.name} (${brand.domain}).
Brand tagline: "${brand.tagline}"

This email is part of an automated sequence. Write:
1. Subject line (under 50 chars, compelling)
2. Email body (3-5 short paragraphs, conversational, on-brand)
3. CTA button text

Format as:
SUBJECT: ...
BODY:
...
CTA: ...
  `.trim();

  const raw = (await think(systemPrompt, userMessage, { fast: false })).trim();
  const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
  const subject = subjectMatch?.[1]?.trim() ?? `${brand.name} — ${sequenceType}`;

  ingestGenerated({
    brand: brandSlug,
    title: `Email (${sequenceType}) — ${subject}`,
    body: raw,
    kind: "email",
    switch: sequenceType === "conversion" ? 5 : 4, // conversion vs trust-building
    metadata: { sequenceType },
  });

  return { sequence: sequenceType, subject, body: raw };
}

export async function diagnoseBrand(
  brandSlug: string,
  context: string
): Promise<{ switchNumber: SwitchNumber; switch: (typeof SEVEN_SWITCHES)[SwitchNumber]; advice: string }> {
  const brand = loadBrand(brandSlug);
  const switchNum = diagnoseSwitchFromContext(context);
  const sw = SEVEN_SWITCHES[switchNum];

  const advice = await think(
    `You are BLUME, Chief of Growth. You are advising on the brand "${brand.name}".
     You use the 7 Sales Switches™ framework to diagnose bottlenecks and prescribe action.
     Be specific, direct, and actionable. 3–5 sentences max.`,
    `Brand: ${brand.name}
     Context: ${context}
     Diagnosed Switch: #${switchNum} — ${sw.name}
     Switch focus: ${sw.focus}

     Give specific advice for this brand on how to progress through Switch #${switchNum}.`
  );

  return { switchNumber: switchNum, switch: sw, advice };
}

export { analyzeSiteForBrand };
export type { PostRequest, GeneratedPost, BlumeMode };
