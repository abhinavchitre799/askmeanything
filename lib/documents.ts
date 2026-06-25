/**
 * Document ingestion: turn extracted text into a Document plus embedded
 * DocumentChunks, and extract text from uploaded files.
 *
 * pgvector note: the `embedding` column is not in the Prisma Client, so chunks
 * are inserted via raw SQL with the vector cast to `::vector`.
 */

import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { chunkText } from "@/lib/chunkText";
import { getLlmClientForProject } from "@/lib/llm";

export interface IngestTextArgs {
  projectId: string;
  sourceId: string;
  title: string | null;
  url: string | null;
  fileName: string | null;
  text: string;
}

export interface IngestTextResult {
  documentId: string;
  chunkCount: number;
}

/** sha256 hex digest of the given text. */
function hashContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Format a numeric vector as a pgvector string literal: [a,b,c]. */
function toVectorString(values: number[]): string {
  return `[${values.join(",")}]`;
}

/**
 * Ingest a single document's text. Dedupes by (projectId, contentHash); on a
 * hash collision the existing document is returned without re-indexing.
 */
export async function ingestText(
  args: IngestTextArgs
): Promise<IngestTextResult> {
  const { projectId, sourceId, title, url, fileName, text } = args;

  const contentHash = hashContent(text);

  // Dedupe: identical content for the same project is indexed only once.
  const existing = await prisma.document.findFirst({
    where: { projectId, contentHash },
    select: { id: true },
  });
  if (existing) {
    return { documentId: existing.id, chunkCount: 0 };
  }

  const document = await prisma.document.create({
    data: {
      projectId,
      sourceId,
      title,
      url,
      fileName,
      contentHash,
      status: "pending",
    },
    select: { id: true },
  });
  const documentId = document.id;

  const sourceTitle = title ?? fileName ?? null;
  const sourceUrl = url ?? null;

  try {
    const chunks = chunkText(text);
    const llm = await getLlmClientForProject(projectId);

    for (const chunk of chunks) {
      const embedding = await llm.createEmbedding(chunk.content);
      const vector = toVectorString(embedding);
      const id = randomUUID();

      // Prisma parameterizes each value; the ::vector cast applies to the bound
      // string param so the embedding is stored correctly.
      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk"
          (id, "projectId", "documentId", content, embedding,
           "tokenCount", "chunkIndex", "sourceTitle", "sourceUrl", "createdAt")
        VALUES
          (${id}, ${projectId}, ${documentId}, ${chunk.content}, ${vector}::vector,
           ${chunk.tokenCount}, ${chunk.chunkIndex}, ${sourceTitle}, ${sourceUrl}, NOW())
      `;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "indexed" },
    });

    return { documentId, chunkCount: chunks.length };
  } catch (err) {
    await prisma.document
      .update({ where: { id: documentId }, data: { status: "error" } })
      .catch(() => {
        /* best-effort status update; surface the original error below */
      });
    const reason = err instanceof Error ? err.message : "unknown error";
    throw new Error(`Failed to index document ${documentId}: ${reason}`);
  }
}

export interface ExtractTextArgs {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

/** Lowercased file extension without the dot, or "" if none. */
function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : "";
}

/**
 * Extract plain text from an uploaded file. Type is determined by extension
 * first, then by mimeType. Supports txt, md, pdf, and docx.
 */
export async function extractTextFromUpload(
  args: ExtractTextArgs
): Promise<string> {
  const { fileName, mimeType, buffer } = args;
  const ext = extensionOf(fileName);
  const mime = mimeType.toLowerCase();

  const isText =
    ext === "txt" || ext === "md" || ext === "markdown" || mime === "text/plain";
  const isMarkdown =
    ext === "md" || ext === "markdown" || mime.includes("markdown");
  const isPdf = ext === "pdf" || mime === "application/pdf";
  const isDocx =
    ext === "docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (isText || isMarkdown) {
    // Keeping raw markdown text is acceptable for retrieval.
    return buffer.toString("utf8");
  }

  if (isPdf) {
    try {
      const pdf = (await import("pdf-parse")).default;
      const data = await pdf(buffer);
      return data.text;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      throw new Error(`Failed to parse PDF "${fileName}": ${reason}`);
    }
  }

  if (isDocx) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      throw new Error(`Failed to parse DOCX "${fileName}": ${reason}`);
    }
  }

  throw new Error(`Unsupported file type: ${fileName}`);
}
