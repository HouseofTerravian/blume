import OpenAI from "openai";
import { config } from "../config.js";
let _client = null;
export function getOpenAI() {
    if (!config.openai.apiKey)
        throw new Error("OPENAI_API_KEY is not set.");
    if (!_client)
        _client = new OpenAI({ apiKey: config.openai.apiKey });
    return _client;
}
export async function chat(systemPrompt, userMessage, opts = {}) {
    const client = getOpenAI();
    const model = opts.fast ? config.openai.modelFast : config.openai.model;
    const response = await client.chat.completions.create({
        model,
        response_format: opts.json ? { type: "json_object" } : { type: "text" },
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
    });
    return response.choices[0]?.message?.content ?? "";
}
//# sourceMappingURL=openai.js.map