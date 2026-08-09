import type { LLMMessage, LLMProvider, LLMResult } from "./types.js";
import { anthropicProvider } from "./anthropic.js";
import { openaiProvider } from "./openai.js";
import { geminiProvider } from "./gemini.js";

export type { LLMMessage, LLMResult };

const ALL_PROVIDERS: Record<string, LLMProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

/**
 * Order to try providers in, e.g. "anthropic,openai,gemini".
 * Defaults to anthropic-only (previous behavior) if unset.
 */
function getProviderOrder(): LLMProvider[] {
  const raw = process.env.PROVIDER_ORDER?.trim();
  const ids = raw ? raw.split(",").map((s: string) => s.trim().toLowerCase()) : ["anthropic"];

  const providers = ids
    .map((id: string) => ALL_PROVIDERS[id])
    .filter((p: LLMProvider | undefined): p is LLMProvider => !!p);

  if (providers.length === 0) {
    throw new Error(
      `PROVIDER_ORDER="${raw}" matched no known providers. Use a comma-separated list of: anthropic, openai, gemini.`
    );
  }
  return providers;
}

/**
 * Calls providers in configured order, falling through to the next one on
 * any failure (missing key, network error, non-2xx, empty response). Throws
 * only if every configured-and-attempted provider fails.
 *
 * Returns both the text and the token count the serving provider reported,
 * so callers can track spend without re-parsing provider-specific payloads.
 *
 * Logs which provider ultimately served the request and which ones were
 * skipped/failed along the way, so failover is visible in server logs.
 */
export async function callLLM(system: string, messages: LLMMessage[], maxTokens = 1000): Promise<LLMResult> {
  const order = getProviderOrder();
  const errors: string[] = [];

  for (const provider of order) {
    if (!provider.isConfigured()) {
      errors.push(`${provider.id}: not configured (no API key)`);
      continue;
    }
    try {
      const result = await provider.call(system, messages, maxTokens);
      if (errors.length > 0) {
        console.warn(`callLLM: served by "${provider.id}" after fallback from: ${errors.join(" | ")}`);
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.warn(`callLLM: "${provider.id}" failed, trying next — ${msg}`);
    }
  }

  throw new Error(`All providers failed or unconfigured:\n${errors.join("\n")}`);
}
