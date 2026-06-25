/**
 * Google Gemini client using the v1beta REST API directly (no SDK).
 * Auth is via the `?key=` query parameter. Config comes from env helpers.
 */

import {
  ChatCompletionArgs,
  ChatMessage,
  LlmClient,
  LlmConfig,
  LlmError,
} from "./types";

type GeminiConfig = Extract<LlmConfig, { provider: "google-gemini" }>;

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const CHAT_TIMEOUT_MS = 60_000;
const EMBEDDING_TIMEOUT_MS = 30_000;

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

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

/** Map a non-2xx Gemini response to a typed LlmError. */
async function errorFromResponse(res: Response): Promise<LlmError> {
  let body = "";
  try {
    body = (await res.text()).slice(0, 500);
  } catch {
    body = "<unreadable response body>";
  }

  // Gemini reports an invalid key as HTTP 400 with "API_KEY_INVALID" in the body.
  const looksLikeBadKey =
    res.status === 400 && /API_KEY_INVALID/i.test(body);

  if (res.status === 401 || res.status === 403 || looksLikeBadKey) {
    return new LlmError(
      "invalid_api_key",
      `Authentication failed (HTTP ${res.status}). Check GOOGLE_GEMINI_API_KEY. ${body}`,
      res.status
    );
  }
  if (res.status === 429) {
    return new LlmError(
      "rate_limited",
      `Rate limited by Gemini (HTTP 429). ${body}`,
      res.status
    );
  }
  return new LlmError(
    "request_failed",
    `Gemini request failed (HTTP ${res.status}). ${body}`,
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
      "Gemini returned a non-JSON or malformed response body."
    );
  }
}

/**
 * Split generic chat messages into a Gemini `systemInstruction` (all system
 * messages joined by newlines) and the conversational `contents` array.
 */
function toGeminiPayload(messages: ChatMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
} {
  const systemTexts: string[] = [];
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemTexts.push(msg.content);
      continue;
    }
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  const payload: ReturnType<typeof toGeminiPayload> = { contents };
  if (systemTexts.length > 0) {
    payload.systemInstruction = { parts: [{ text: systemTexts.join("\n") }] };
  }
  return payload;
}

export class GoogleGeminiClient implements LlmClient {
  constructor(private readonly config: GeminiConfig) {}

  async createChatCompletion(args: ChatCompletionArgs): Promise<string> {
    const { apiKey, chatModel } = this.config;

    const { systemInstruction, contents } = toGeminiPayload(args.messages);

    const generationConfig: Record<string, unknown> = {
      temperature: args.temperature ?? 0.2,
    };
    if (args.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = args.maxTokens;
    }

    const body: Record<string, unknown> = { contents, generationConfig };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const res = await fetchWithTimeout(
      `${BASE_URL}/models/${chatModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      CHAT_TIMEOUT_MS
    );

    if (!res.ok) throw await errorFromResponse(res);

    const data = (await parseJson(res)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
      promptFeedback?: { blockReason?: string };
    };

    const candidate = data?.candidates?.[0];
    if (!candidate) {
      const reason = data?.promptFeedback?.blockReason;
      if (reason) {
        throw new LlmError(
          "malformed_response",
          `Response was blocked: ${reason}`
        );
      }
      throw new LlmError(
        "malformed_response",
        "Gemini response missing candidates[0]."
      );
    }

    const text = (candidate.content?.parts ?? [])
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("");
    if (text.trim() === "") {
      throw new LlmError(
        "malformed_response",
        "Gemini response candidate contained no text parts."
      );
    }
    return text.trim();
  }

  async createEmbedding(text: string): Promise<number[]> {
    const { apiKey, embeddingModel, embeddingDimension } = this.config;

    const res = await fetchWithTimeout(
      `${BASE_URL}/models/${embeddingModel}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // outputDimensionality pins the vector size to the pgvector column
        // (some models, e.g. gemini-embedding-001, default to 3072).
        body: JSON.stringify({
          model: `models/${embeddingModel}`,
          content: { parts: [{ text }] },
          outputDimensionality: embeddingDimension,
        }),
      },
      EMBEDDING_TIMEOUT_MS
    );

    if (!res.ok) throw await errorFromResponse(res);

    const data = (await parseJson(res)) as {
      embedding?: { values?: unknown };
    };
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || !values.every((n) => typeof n === "number")) {
      throw new LlmError(
        "malformed_response",
        "Gemini embedding response missing embedding.values number array."
      );
    }
    return values as number[];
  }
}

export function createGoogleGeminiClient(config: GeminiConfig): LlmClient {
  return new GoogleGeminiClient(config);
}
