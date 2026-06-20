/**
 * SEO content generation — BLUME insight mode.
 * Festival-specific SEO and general brand SEO.
 */

import { think } from "../integrations/ai.js";
import { ingestGenerated } from "./ingestGenerated.js";

export interface SEOContent {
  meta_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  social_posts: Array<{ platform: string; content: string }>;
  confidence: "high" | "medium" | "low";
}

function calcConfidence(data: {
  description?: string | null;
  website?: string | null;
  start_date?: string | null;
}): "high" | "medium" | "low" {
  const score =
    (data.description ? 2 : 0) + (data.website ? 1 : 0) + (data.start_date ? 1 : 0);
  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

export async function generateFestivalSEO(festival: {
  name: string;
  city: string;
  state?: string | null;
  category: string;
  description?: string | null;
  website?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}): Promise<SEOContent> {
  const location = festival.state ? `${festival.city}, ${festival.state}` : festival.city;
  const dateStr =
    festival.start_date
      ? festival.end_date && festival.end_date !== festival.start_date
        ? `${festival.start_date} to ${festival.end_date}`
        : festival.start_date
      : "";

  const system =
    "You are an SEO content writer specializing in festival and event discovery. " +
    "Write concise, keyword-rich content optimized for local search. " +
    "Always respond with valid JSON only — no explanation, no markdown, no code fences.";

  const user = `Generate SEO content for this festival listing.

Festival: ${festival.name}
Location: ${location}
Category: ${festival.category}
${dateStr ? `Dates: ${dateStr}` : ""}
${festival.description ? `Description: ${festival.description}` : ""}
${festival.website ? `Website: ${festival.website}` : ""}

Return a JSON object with exactly these fields:
{
  "meta_title": "festival name + location, under 60 chars",
  "meta_description": "compelling 150-155 char description with CTA",
  "h1": "natural page heading under 70 chars",
  "intro": "exactly 150-word intro paragraph, keyword-rich",
  "social_posts": [
    { "platform": "twitter", "content": "tweet under 280 chars" },
    { "platform": "instagram", "content": "caption with hashtags" },
    { "platform": "facebook", "content": "post 100-150 chars" }
  ]
}`;

  const raw = await think(system, user);
  const confidence = calcConfidence(festival);

  try {
    const parsed = JSON.parse(stripFences(raw)) as Omit<SEOContent, "confidence">;
    return { ...parsed, confidence };
  } catch {
    return {
      meta_title: `${festival.name} | ${location} | FestivalCalendar.online`,
      meta_description: `Discover ${festival.name} in ${location}. A ${festival.category.toLowerCase()} festival. Find dates, tickets, and more on FestivalCalendar.online.`,
      h1: `${festival.name} — ${location}`,
      intro: `${festival.name} is a ${festival.category.toLowerCase()} festival in ${location}.${dateStr ? ` ${dateStr}.` : ""} ${festival.description ?? "A must-see event."}`,
      social_posts: [
        { platform: "twitter",   content: `🎉 ${festival.name} is coming to ${location}! ${festival.category} festival → festivalcalendar.online` },
        { platform: "instagram", content: `${festival.name} 🎊 ${location}\n${festival.category} festival. Save the date!\n#festival #${festival.category.toLowerCase()} #${festival.city.replace(/\s/g, "").toLowerCase()}` },
        { platform: "facebook",  content: `${festival.name} is coming to ${location}! Check it out on FestivalCalendar.online` },
      ],
      confidence,
    };
  }
}

export async function generateSEOContent(input: {
  brand: string;
  topic: string;
  url?: string;
}): Promise<SEOContent> {
  const system =
    "You are an SEO content strategist for digital brands. " +
    "Write compelling, keyword-rich content. " +
    "Always respond with valid JSON only — no explanation, no markdown, no code fences.";

  const user = `Generate SEO content for this topic.

Brand: ${input.brand}
Topic: ${input.topic}
${input.url ? `URL/Reference: ${input.url}` : ""}

Return a JSON object with exactly these fields:
{
  "meta_title": "keyword-rich title under 60 chars",
  "meta_description": "compelling 150-155 char description with CTA",
  "h1": "natural page heading under 70 chars",
  "intro": "exactly 150-word intro paragraph, keyword-rich",
  "social_posts": [
    { "platform": "twitter", "content": "tweet under 280 chars" },
    { "platform": "instagram", "content": "caption with hashtags" },
    { "platform": "facebook", "content": "post 100-150 chars" }
  ]
}`;

  const raw = await think(system, user);

  let result: SEOContent;
  try {
    const parsed = JSON.parse(stripFences(raw)) as Omit<SEOContent, "confidence">;
    result = { ...parsed, confidence: "high" };
  } catch {
    result = {
      meta_title: `${input.topic} | ${input.brand}`,
      meta_description: `Learn about ${input.topic} from ${input.brand}. Discover insights and resources.`,
      h1: input.topic,
      intro: `${input.topic} is a key focus for ${input.brand}. This page covers everything you need to know about ${input.topic}.${input.url ? ` More at ${input.url}.` : ""}`,
      social_posts: [
        { platform: "twitter",   content: `New content on ${input.topic} from ${input.brand} 👇` },
        { platform: "instagram", content: `${input.topic} — everything you need to know.\n#${input.brand.replace(/\s/g, "")} #${input.topic.replace(/\s/g, "")}` },
        { platform: "facebook",  content: `Explore ${input.topic} with ${input.brand}. Read more on our website.` },
      ],
      confidence: "high",
    };
  }

  // Auto-create a Creative Drafts artifact (SEO/page copy) so Lotus reflects it.
  ingestGenerated({
    brand: input.brand,
    title: `SEO — ${input.topic}`,
    body: `${result.meta_title}\n${result.meta_description}\n${result.h1}\n${result.intro}`,
    kind: "seo",
    switch: 3, // Traffic
    metadata: { topic: input.topic, url: input.url ?? null },
  });

  return result;
}
