/**
 * Centralised, validated access to environment variables.
 *
 * We never hardcode API keys or model names; everything provider-specific is
 * read here and surfaced with clear errors. Import the small helpers rather
 * than reading process.env directly elsewhere.
 */

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

export function getLlmProvider(): LlmProvider {
  const value = process.env.LLM_PROVIDER?.trim();
  if (!value) {
    throw new Error(
      "Missing required environment variable: LLM_PROVIDER. " +
        'Set it to "openai-compatible" or "google-gemini".'
    );
  }
  if (value !== "openai-compatible" && value !== "google-gemini") {
    throw new Error(
      `Unsupported LLM_PROVIDER "${value}". ` +
        'Allowed values are "openai-compatible" or "google-gemini".'
    );
  }
  return value;
}

/** Config for the OpenAI-compatible provider. Validated lazily on first use. */
export function getOpenAiCompatibleConfig() {
  return {
    baseUrl: required("LLM_API_BASE_URL").replace(/\/+$/, ""),
    apiKey: required("LLM_API_KEY"),
    chatModel: required("LLM_CHAT_MODEL"),
    embeddingModel: required("LLM_EMBEDDING_MODEL"),
  };
}

/** Config for the Google Gemini provider. Validated lazily on first use. */
export function getGeminiConfig() {
  return {
    apiKey: required("GOOGLE_GEMINI_API_KEY"),
    chatModel: required("GOOGLE_GEMINI_CHAT_MODEL"),
    embeddingModel: required("GOOGLE_GEMINI_EMBEDDING_MODEL"),
  };
}

/** Vector dimension used by pgvector. Must match the embedding model output. */
export function getEmbeddingDimension(): number {
  return optionalNumber("EMBEDDING_DIMENSION", 768);
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
