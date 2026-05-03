import OpenAI from "openai";
import { config, type ModelProvider } from "./config.js";

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

class LLMClient {
  private client: OpenAI;
  public provider: string;

  constructor(provider: string, apiKey: string, apiBase: string) {
    this.provider = provider;
    this.client = new OpenAI({ apiKey, baseURL: apiBase });
  }

  async chat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    model: string,
    temperature = 0.8,
    maxTokens = 4096,
    system?: string,
  ): Promise<LLMResponse> {
    const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (system) msgs.push({ role: "system", content: system });
    msgs.push(...messages);

    const response = await this.client.chat.completions.create({
      model,
      messages: msgs,
      temperature,
      max_tokens: maxTokens,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content || "",
      model: response.model,
      provider: this.provider,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }
}

export class ModelRouter {
  private clients: Map<string, LLMClient> = new Map();
  public defaultProvider: ModelProvider;

  constructor() {
    this.defaultProvider = config.defaultProvider;

    if (config.mimo.apiKey) {
      this.clients.set(
        "mimo",
        new LLMClient("mimo", config.mimo.apiKey, config.mimo.apiBase),
      );
    }
    if (config.openai.apiKey) {
      this.clients.set(
        "openai",
        new LLMClient("openai", config.openai.apiKey, config.openai.apiBase),
      );
    }
  }

  getClient(provider?: ModelProvider): LLMClient {
    const p = provider || this.defaultProvider;
    const client = this.clients.get(p);
    if (!client) throw new Error(`Provider '${p}' not configured (check API keys)`);
    return client;
  }

  async chat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: {
      model?: string;
      provider?: ModelProvider;
      temperature?: number;
      maxTokens?: number;
      system?: string;
    },
  ): Promise<LLMResponse> {
    const client = this.getClient(options?.provider);
    return client.chat(
      messages,
      options?.model || config.defaultModel,
      options?.temperature ?? 0.8,
      options?.maxTokens ?? 4096,
      options?.system,
    );
  }
}

export const router = new ModelRouter();
