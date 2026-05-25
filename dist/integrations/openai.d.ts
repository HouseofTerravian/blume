import OpenAI from "openai";
export declare function getOpenAI(): OpenAI;
export declare function chat(systemPrompt: string, userMessage: string, opts?: {
    fast?: boolean;
    json?: boolean;
}): Promise<string>;
//# sourceMappingURL=openai.d.ts.map