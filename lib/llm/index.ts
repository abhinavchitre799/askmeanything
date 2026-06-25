/**
 * Provider-agnostic entry point. Application code calls getLlmClient() and
 * never imports a concrete provider. The provider is chosen by env and the
 * resulting client instance is memoized per provider.
 */

import { getLlmProvider, type LlmProvider } from "@/lib/env";
import type { LlmClient } from "./types";
import { createOpenAiCompatibleClient } from "./openaiCompatibleClient";
import { createGoogleGeminiClient } from "./googleGeminiClient";

export * from "./types";

let cachedClient: LlmClient | null = null;
let cachedProvider: LlmProvider | null = null;

export function getLlmClient(): LlmClient {
  const provider = getLlmProvider();

  // Reuse the cached instance only when the provider hasn't changed.
  if (cachedClient && cachedProvider === provider) {
    return cachedClient;
  }

  let client: LlmClient;
  switch (provider) {
    case "openai-compatible":
      client = createOpenAiCompatibleClient();
      break;
    case "google-gemini":
      client = createGoogleGeminiClient();
      break;
    default:
      // getLlmProvider already validates, but guard exhaustively for safety.
      throw new Error(`Unsupported LLM provider: ${provider as string}`);
  }

  cachedClient = client;
  cachedProvider = provider;
  return client;
}
