/**
 * OpenAI-compatible LLM client (OpenAI, Together, Groq, LocalAI, etc.).
 * Uses raw `fetch` against the standard /chat/completions and /embeddings
 * endpoints — no provider SDK. Config is supplied explicitly per project.
 */

import {
  ChatCompletionArgs,
  LlmClient,
  LlmConfig,
  LlmError,
} from "./types";

type OpenAiConfig = Extract<LlmConfig, { provider: "openai-compatible" }>;

const CHAT_TIMEOUT_MS = 60_000;
const EMBEDDING_TIMEOUT_MS = 30_000;

/** Perform a fetch with an AbortController-based timeout, wrapping network errors. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? `Request timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : "Unknown network error";
    throw new LlmError("request_failed", `Network request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Map a non-2xx response to a typed LlmError, including a concise body excerpt. */
async function errorFromResponse(res: Response): Promise<LlmError> {
  let body = "";
  try {
    body = (await res.text()).slice(0, 500);
  } catch {
    body = "<unreadable response body>";
  }

  if (res.status === 401 || res.status === 403) {
    return new LlmError(
      "invalid_api_key",
      `Authentication failed (HTTP ${res.status}). Check LLM_API_KEY. ${body}`,
      res.status
    );
  }
  if (res.status === 429) {
    return new LlmError(
      "rate_limited",
      `Rate limited by provider (HTTP 429). ${body}`,
      res.status
    );
  }
  return new LlmError(
    "request_failed",
    `Provider request failed (HTTP ${res.status}). ${body}`,
    res.status
  );
}

/** Parse JSON defensively; malformed bodies become a typed error. */
async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new LlmError(
      "malformed_response",
      "Provider returned a non-JSON or malformed response body."
    );
  }
}

export class OpenAiCompatibleClient implements LlmClient {
  constructor(private readonly config: OpenAiConfig) {}

  async createChatCompletion(args: ChatCompletionArgs): Promise<string> {
    const { baseUrl, apiKey, chatModel } = this.config;

    const body: Record<string, unknown> = {
      model: chatModel,
      messages: args.messages,
      temperature: args.temperature ?? 0.2,
    };
    if (args.maxTokens !== undefined) {
      body.max_tokens = args.maxTokens;
    }

    const res = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      CHAT_TIMEOUT_MS
    );

    if (!res.ok) throw await errorFromResponse(res);

    const data = (await parseJson(res)) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LlmError(
        "malformed_response",
        "Chat completion response missing choices[0].message.content."
      );
    }
    return content.trim();
  }

  async createEmbedding(text: string): Promise<number[]> {
    const { baseUrl, apiKey, embeddingModel } = this.config;

    const res = await fetchWithTimeout(
      `${baseUrl}/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: embeddingModel, input: text }),
      },
      EMBEDDING_TIMEOUT_MS
    );

    if (!res.ok) throw await errorFromResponse(res);

    const data = (await parseJson(res)) as {
      data?: Array<{ embedding?: unknown }>;
    };
    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || !embedding.every((n) => typeof n === "number")) {
      throw new LlmError(
        "malformed_response",
        "Embedding response missing data[0].embedding number array."
      );
    }
    return embedding as number[];
  }
}

export function createOpenAiCompatibleClient(config: OpenAiConfig): LlmClient {
  return new OpenAiCompatibleClient(config);
}
