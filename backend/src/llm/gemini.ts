import type { LLMMessage, LLMProvider } from "./types.js";
import { ProviderError } from "./types.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const geminiProvider: LLMProvider = {
  id: "gemini",

  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  },

  async call(system, messages, maxTokens) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderError("gemini", "GEMINI_API_KEY is not set");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    // Gemini uses "model" instead of "assistant" for the model's own turns.
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ProviderError("gemini", `HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();

    if (!text) throw new ProviderError("gemini", "empty response (possibly blocked by safety filters)");

    const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0;
    return { text, tokensUsed };
  },
};
