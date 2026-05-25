import "dotenv/config";

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    modelFast: process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: "claude-sonnet-4-6",
  },
  vault: {
    root: process.env.VAULT_ROOT ?? "./vaults",
  },
  server: {
    name: process.env.MCP_SERVER_NAME ?? "blume",
    version: process.env.MCP_SERVER_VERSION ?? "1.0.0",
  },
};
