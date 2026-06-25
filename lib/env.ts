/**
 * Centralised, validated access to environment variables.
 *
 * We never hardcode API keys or model names; everything provider-specific is
 * read here and surfaced with clear errors. Import the small helpers rather
 * than reading process.env directly elsewhere.
 */

import type { LlmConfig } from "@/lib/llm/types";

export type LlmProvider = "openai-compatible" | "google-gemini";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file (see .env.example).`
    );
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getAppUrl(): string {
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

function optionalString(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** Vector dimension for the env fallback config. */
export function getEmbeddingDimension(): number {
  return optionalNumber("EMBEDDING_DIMENSION", 768);
}

/**
 * Optional global LLM config built from environment variables. This is only a
 * FALLBACK for local development; the primary path is per-project credentials
 * (Bring Your Own Key) stored in the database. Returns null when env is not
 * fully configured — it never throws, because a missing fallback is normal.
 */
export function getEnvLlmConfig(): LlmConfig | null {
  const provider = optionalString("LLM_PROVIDER");
  if (provider === "google-gemini") {
    const apiKey = optionalString("GOOGLE_GEMINI_API_KEY");
    const chatModel = optionalString("GOOGLE_GEMINI_CHAT_MODEL");
    const embeddingModel = optionalString("GOOGLE_GEMINI_EMBEDDING_MODEL");
    if (!apiKey || !chatModel || !embeddingModel) return null;
    return {
      provider: "google-gemini",
      apiKey,
      chatModel,
      embeddingModel,
      embeddingDimension: getEmbeddingDimension(),
    };
  }
  if (provider === "openai-compatible") {
    const baseUrl = optionalString("LLM_API_BASE_URL");
    const apiKey = optionalString("LLM_API_KEY");
    const chatModel = optionalString("LLM_CHAT_MODEL");
    const embeddingModel = optionalString("LLM_EMBEDDING_MODEL");
    if (!baseUrl || !apiKey || !chatModel || !embeddingModel) return null;
    return {
      provider: "openai-compatible",
      baseUrl: baseUrl.replace(/\/+$/, ""),
      apiKey,
      chatModel,
      embeddingModel,
    };
  }
  return null;
}

/** Max pages a single crawl job will fetch (MVP safety limit). */
export function getCrawlMaxPages(): number {
  return optionalNumber("CRAWL_MAX_PAGES", 50);
}

/**
 * Live-crawl fallback: when the knowledge base can't answer a question, the
 * chat flow can crawl a few pages of the project's website on demand and index
 * them, then retry retrieval. Disable by setting LIVE_CRAWL_FALLBACK="false".
 */
export function isLiveCrawlFallbackEnabled(): boolean {
  const raw = process.env.LIVE_CRAWL_FALLBACK?.trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

/** Max pages fetched during an on-demand live-crawl fallback (kept small for latency). */
export function getLiveCrawlMaxPages(): number {
  return optionalNumber("LIVE_CRAWL_MAX_PAGES", 5);
}

/**
 * Cosine-similarity threshold below which retrieved chunks are considered
 * insufficient and the live-crawl fallback is triggered. Model-dependent;
 * tune per embedding model. Range roughly 0..1 for normalized embeddings.
 */
export function getRetrievalMinSimilarity(): number {
  return optionalNumber("RETRIEVAL_MIN_SIMILARITY", 0.3);
}
