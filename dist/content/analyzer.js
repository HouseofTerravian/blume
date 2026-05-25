import axios from "axios";
import * as cheerio from "cheerio";
import { think } from "../integrations/ai.js";
export async function scrapeSite(url) {
    const response = await axios.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BLUME/1.0)" },
    });
    const $ = cheerio.load(response.data);
    const title = $("title").text().trim();
    const description = $('meta[name="description"]').attr("content") ?? "";
    const headings = $("h1, h2, h3")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .slice(0, 20);
    $("nav, footer, script, style, noscript").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);
    const links = $("a[href]")
        .map((_, el) => $(el).attr("href") ?? "")
        .get()
        .filter(href => href.startsWith("http"))
        .slice(0, 30);
    return { url, title, description, headings, bodyText, links, analyzedAt: new Date().toISOString() };
}
export async function analyzeSiteForBrand(url, brandSlug) {
    const site = await scrapeSite(url);
    const systemPrompt = `
You are BLUME — Chief of Growth, Vaults & Narrative Commerce.
You are analyzing a website to identify strategic growth opportunities for the brand "${brandSlug}".
You think like a senior marketing strategist with deep knowledge of AIDA, the 7 Sales Switches,
content strategy, and conversion optimization.

Respond in valid JSON with this exact structure:
{
  "summary": "2-3 sentence overview of what the site is doing and its current state",
  "opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "suggestedPosts": ["post idea 1", "post idea 2", "post idea 3"]
}
  `.trim();
    const userMessage = `
Analyze this website for strategic growth opportunities:

URL: ${site.url}
Title: ${site.title}
Meta Description: ${site.description}
Key Headings: ${site.headings.join(" | ")}
Body Text Excerpt: ${site.bodyText.slice(0, 1500)}
  `.trim();
    const raw = await think(systemPrompt, userMessage, { json: true });
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        parsed = { summary: raw, opportunities: [], recommendedActions: [], suggestedPosts: [] };
    }
    return { url, brand: brandSlug, ...parsed, analyzedAt: new Date().toISOString() };
}
//# sourceMappingURL=analyzer.js.map