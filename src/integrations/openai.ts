import OpenAI from "openai";
import { config } from "../config.js";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!config.openai.apiKey) throw new Error("OPENAI_API_KEY is not set.");
  if (!_client) _client = new OpenAI({ apiKey: config.openai.apiKey });
  return _client;
}

export async function chat(
  systemPrompt: string,
  userMessage: string,
  opts: { fast?: boolean; json?: boolean } = {}
): Promise<string> {
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
