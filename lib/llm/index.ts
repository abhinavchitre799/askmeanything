/**
 * Provider-agnostic entry point.
 *
 * Application code resolves an LlmClient FOR A PROJECT — it never imports a
 * concrete provider and never reads credentials directly. Credentials are
 * Bring-Your-Own-Key: stored per project (encrypted) and resolved here, with
 * the global env config as an optional local-dev fallback.
 */

import { prisma } from "@/lib/prisma";
import { getEnvLlmConfig } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto";
import { LlmClient, LlmConfig, LlmError } from "./types";
import { createOpenAiCompatibleClient } from "./openaiCompatibleClient";
import { createGoogleGeminiClient } from "./googleGeminiClient";

export * from "./types";

/** Build a client from a fully-resolved config. */
export function buildLlmClient(config: LlmConfig): LlmClient {
  switch (config.provider) {
    case "openai-compatible":
      return createOpenAiCompatibleClient(config);
    case "google-gemini":
      return createGoogleGeminiClient(config);
    default:
      throw new LlmError(
        "missing_config",
        `Unsupported LLM provider: ${(config as { provider: string }).provider}`
      );
  }
}

/**
 * Resolve the effective LLM config for a project: the project's stored
 * Bring-Your-Own-Key settings if present, otherwise the global env fallback.
 * Throws a clear LlmError when neither is configured.
 */
export async function resolveLlmConfig(projectId: string): Promise<LlmConfig> {
  const stored = await prisma.projectLlmConfig.findUnique({
    where: { projectId },
  });

  if (stored) {
    const apiKey = decryptSecret(stored.apiKeyEncrypted);
    if (stored.provider === "google-gemini") {
      return {
        provider: "google-gemini",
        apiKey,
        chatModel: stored.chatModel,
        embeddingModel: stored.embeddingModel,
        embeddingDimension: stored.embeddingDimension,
      };
    }
    if (stored.provider === "openai-compatible") {
      return {
        provider: "openai-compatible",
        apiKey,
        baseUrl: (stored.apiBaseUrl ?? "").replace(/\/+$/, ""),
        chatModel: stored.chatModel,
        embeddingModel: stored.embeddingModel,
      };
    }
  }

  const envConfig = getEnvLlmConfig();
  if (envConfig) return envConfig;

  throw new LlmError(
    "missing_config",
    "This project has no AI provider configured. Add an API key in the admin " +
      "(Sources → AI settings), or set a global provider in the environment."
  );
}

/** Convenience: resolve a project's config and build its client. */
export async function getLlmClientForProject(
  projectId: string
): Promise<LlmClient> {
  return buildLlmClient(await resolveLlmConfig(projectId));
}
