import type { LLMMessage, LLMProvider } from "./types.js";
import { ProviderError } from "./types.js";

const URL_ = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export const openaiProvider: LLMProvider = {
  id: "openai",

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  },

  async call(system, messages, maxTokens) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ProviderError("openai", "OPENAI_API_KEY is not set");

    const response = await fetch(URL_, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ProviderError("openai", `HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text) throw new ProviderError("openai", "empty response");

    const tokensUsed = data.usage?.total_tokens ?? 0;
    return { text, tokensUsed };
  },
};
