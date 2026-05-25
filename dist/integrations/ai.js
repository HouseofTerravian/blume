/**
 * Unified AI interface. OpenAI is primary; Anthropic is fallback.
 * If OpenAI key is missing, falls back to Anthropic automatically.
 */
import { chat as openaiChat } from "./openai.js";
import { chat as anthropicChat } from "./anthropic.js";
import { config } from "../config.js";
export async function think(systemPrompt, userMessage, opts = {}) {
    if (opts.forceClaude || !config.openai.apiKey) {
        return anthropicChat(systemPrompt, userMessage);
    }
    try {
        return await openaiChat(systemPrompt, userMessage, opts);
    }
    catch (err) {
        console.warn("[AI] OpenAI failed, falling back to Anthropic:", err.message);
        return anthropicChat(systemPrompt, userMessage);
    }
}
//# sourceMappingURL=ai.js.map