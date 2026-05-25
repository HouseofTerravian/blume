import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
let _client = null;
export function getAnthropic() {
    if (!config.anthropic.apiKey)
        throw new Error("ANTHROPIC_API_KEY is not set.");
    if (!_client)
        _client = new Anthropic({ apiKey: config.anthropic.apiKey });
    return _client;
}
export async function chat(systemPrompt, userMessage) {
    const client = getAnthropic();
    const response = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : "";
}
//# sourceMappingURL=anthropic.js.map