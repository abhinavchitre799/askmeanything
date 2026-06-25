/**
 * Generic LLM interface. The rest of the application depends ONLY on this
 * contract and never on a concrete provider. Switching providers is a matter
 * of changing LLM_PROVIDER in the environment — no application code changes.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionArgs {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmClient {
  /** Embed a single piece of text into a numeric vector. */
  createEmbedding(text: string): Promise<number[]>;

  /** Generate a chat completion and return the plain-text answer. */
  createChatCompletion(args: ChatCompletionArgs): Promise<string>;
}

/**
 * Thrown by provider clients for any LLM failure. Carries a machine-readable
 * `code` so callers can map to safe, user-facing messages without leaking
 * provider internals or secrets.
 */
export class LlmError extends Error {
  code:
    | "missing_config"
    | "invalid_api_key"
    | "rate_limited"
    | "malformed_response"
    | "request_failed";

  status?: number;

  constructor(
    code: LlmError["code"],
    message: string,
    status?: number
  ) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
  }
}
