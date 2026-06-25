/**
 * Answer generation: retrieve relevant chunks for a question, ground the LLM
 * on them, and return the answer plus a deduped list of sources.
 *
 * Live-crawl fallback: if the knowledge base has no sufficiently relevant
 * content for the question, we crawl a few pages of the project's website on
 * demand, index them, and retry retrieval once before giving up. This lets the
 * widget answer from the live site even when nothing was pre-indexed.
 */

import { getLlmClientForProject } from "@/lib/llm";
import {
  SYSTEM_PROMPT,
  NO_CONTEXT_FALLBACK,
  buildAnswerUserMessage,
  type ContextChunk,
} from "@/lib/prompts";
import { searchChunks, type RetrievedChunk } from "@/lib/retrieval";
import { liveCrawlProjectWebsite } from "@/lib/crawler";
import {
  isLiveCrawlFallbackEnabled,
  getRetrievalMinSimilarity,
} from "@/lib/env";

export interface AnswerSource {
  title: string;
  url: string | null;
  type: "website" | "file";
}

export interface AnswerResult {
  answer: string;
  sources: AnswerSource[];
  usedContext: boolean;
  /** True when the live-crawl fallback ran for this question. */
  liveCrawled?: boolean;
}

export interface GenerateAnswerArgs {
  projectId: string;
  question: string;
  topK?: number;
}

/** Cap on distinct sources surfaced alongside an answer. */
const MAX_SOURCES = 4;

/**
 * Per-project throttle for the live-crawl fallback. Prevents repeated questions
 * from triggering a crawl on every message. Combined with content-hash dedupe
 * in ingestText, fallbacks stay cheap.
 */
const LIVE_CRAWL_COOLDOWN_MS = 60_000;
const lastLiveCrawlAt = new Map<string, number>();

/**
 * Build a deduped (by title+url) source list from retrieved chunks. A chunk
 * with a sourceUrl is treated as a website; otherwise it is a file.
 */
function buildSources(
  chunks: Array<{ sourceTitle: string | null; sourceUrl: string | null }>
): AnswerSource[] {
  const seen = new Set<string>();
  const sources: AnswerSource[] = [];

  for (const chunk of chunks) {
    const url = chunk.sourceUrl ?? null;
    const title = chunk.sourceTitle ?? "Source";
    const key = `${title}|${url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    sources.push({
      title,
      url,
      type: url ? "website" : "file",
    });
    if (sources.length >= MAX_SOURCES) break;
  }

  return sources;
}

/** Retrieved chunks are "sufficient" when the best similarity clears the threshold. */
function isSufficient(chunks: RetrievedChunk[]): boolean {
  if (chunks.length === 0) return false;
  const best = Math.max(...chunks.map((c) => c.similarity));
  return best >= getRetrievalMinSimilarity();
}

/** True when this project is allowed to live-crawl again (cooldown elapsed). */
function canLiveCrawl(projectId: string): boolean {
  const last = lastLiveCrawlAt.get(projectId);
  if (last === undefined) return true;
  return Date.now() - last >= LIVE_CRAWL_COOLDOWN_MS;
}

/**
 * Retrieve context for the question and generate a grounded answer. When the
 * knowledge base lacks a relevant answer, attempt a bounded live crawl of the
 * project's website and retry once. Falls back to a safe message if still empty.
 */
export async function generateAnswer(
  args: GenerateAnswerArgs
): Promise<AnswerResult> {
  const { projectId, question, topK } = args;

  let chunks = await searchChunks({ projectId, query: question, topK });
  let liveCrawled = false;

  // Knowledge base couldn't answer confidently -> try the live website.
  if (
    !isSufficient(chunks) &&
    isLiveCrawlFallbackEnabled() &&
    canLiveCrawl(projectId)
  ) {
    lastLiveCrawlAt.set(projectId, Date.now());
    const { pagesIndexed } = await liveCrawlProjectWebsite({ projectId });
    liveCrawled = true;
    if (pagesIndexed > 0) {
      chunks = await searchChunks({ projectId, query: question, topK });
    }
  }

  if (chunks.length === 0) {
    return {
      answer: NO_CONTEXT_FALLBACK,
      sources: [],
      usedContext: false,
      liveCrawled,
    };
  }

  const contextChunks: ContextChunk[] = chunks.map((chunk) => ({
    content: chunk.content,
    sourceTitle: chunk.sourceTitle,
    sourceUrl: chunk.sourceUrl,
  }));

  const llm = await getLlmClientForProject(projectId);
  const answer = await llm.createChatCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildAnswerUserMessage(question, contextChunks) },
    ],
    temperature: 0.2,
    maxTokens: 800,
  });

  return {
    answer,
    sources: buildSources(chunks),
    usedContext: true,
    liveCrawled,
  };
}
