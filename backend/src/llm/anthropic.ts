import type { LLMMessage, LLMProvider } from "./types.js";
import { ProviderError } from "./types.js";

const URL_ = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export const anthropicProvider: LLMProvider = {
  id: "anthropic",

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  },

  async call(system, messages, maxTokens) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ProviderError("anthropic", "ANTHROPIC_API_KEY is not set");

    const response = await fetch(URL_, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ProviderError("anthropic", `HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((block: { type: string; text?: string }) => (block.type === "text" ? block.text ?? "" : ""))
      .join("\n")
      .trim();

    if (!text) throw new ProviderError("anthropic", "empty response");

    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return { text, tokensUsed };
  },
};
