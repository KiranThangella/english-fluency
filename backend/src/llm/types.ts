export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMResult {
  text: string;
  /** Total tokens (input + output) the provider says this call cost. 0 if unknown. */
  tokensUsed: number;
}

export interface LLMProvider {
  /** Short id used in PROVIDER_ORDER, logs, and error messages. */
  id: "anthropic" | "openai" | "gemini";
  /** True if this provider has the env vars it needs to be called at all. */
  isConfigured(): boolean;
  /** Throws on failure — the fallback chain decides what to do next. */
  call(system: string, messages: LLMMessage[], maxTokens: number): Promise<LLMResult>;
}

export class ProviderError extends Error {
  constructor(public provider: string, message: string) {
    super(`[${provider}] ${message}`);
  }
}
