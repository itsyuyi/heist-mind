import "dotenv/config";

export type ModelProvider = "mimo" | "openai";

export const config = {
  mimo: {
    apiKey: process.env.MIMO_API_KEY || "",
    apiBase: process.env.MIMO_API_BASE || "https://api.xiaomimimo.com/v1",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    apiBase: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
  },
  defaultProvider: (process.env.DEFAULT_MODEL_PROVIDER || "mimo") as ModelProvider,
  defaultModel: process.env.DEFAULT_MODEL_NAME || "mimo-v2.5-pro",
  host: process.env.HOST || "0.0.0.0",
  port: parseInt(process.env.PORT || "8000", 10),
};
