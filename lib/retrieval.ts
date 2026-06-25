/**
 * Vector retrieval over DocumentChunks.
 *
 * Similarity search is done with pgvector's cosine distance operator (`<=>`).
 * Queries are STRICTLY scoped to a single projectId; results never cross
 * project boundaries.
 */

import { prisma } from "@/lib/prisma";
import { getLlmClient } from "@/lib/llm";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  similarity: number;
}

export interface SearchChunksArgs {
  projectId: string;
  query: string;
  topK?: number;
}

/** Format a numeric vector as a pgvector string literal: [a,b,c]. */
function toVectorString(values: number[]): string {
  return `[${values.join(",")}]`;
}

interface ChunkRow {
  id: string;
  documentId: string;
  content: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  similarity: number;
}

/**
 * Embed the query and return the topK most similar chunks for the project,
 * ordered by cosine similarity (highest first). Returns [] when there are no
 * matching chunks.
 */
export async function searchChunks(
  args: SearchChunksArgs
): Promise<RetrievedChunk[]> {
  const { projectId, query } = args;
  const topK = args.topK ?? 5;

  const embedding = await getLlmClient().createEmbedding(query);
  const vec = toVectorString(embedding);

  const rows = await prisma.$queryRaw<ChunkRow[]>`
    SELECT id, "documentId", content, "sourceTitle", "sourceUrl",
           1 - (embedding <=> ${vec}::vector) AS similarity
    FROM "DocumentChunk"
    WHERE "projectId" = ${projectId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vec}::vector ASC
    LIMIT ${topK}
  `;

  return rows.map((row) => ({
    chunkId: row.id,
    documentId: row.documentId,
    content: row.content,
    sourceTitle: row.sourceTitle,
    sourceUrl: row.sourceUrl,
    similarity: Number(row.similarity),
  }));
}
