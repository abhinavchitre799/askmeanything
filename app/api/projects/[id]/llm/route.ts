import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, safeMessage } from "@/lib/http";
import { llmConfigSchema, formatZodError } from "@/lib/validation";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

const DEFAULT_DIMENSION: Record<string, number> = {
  "google-gemini": 768,
  "openai-compatible": 1536,
};

/**
 * GET the project's LLM config. The API key is NEVER returned — only a masked
 * hint so the admin can confirm something is configured.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return fail("Project not found", 404);

    const config = await prisma.projectLlmConfig.findUnique({
      where: { projectId: params.id },
    });
    if (!config) return ok({ configured: false });

    let keyHint = "";
    try {
      keyHint = maskSecret(decryptSecret(config.apiKeyEncrypted));
    } catch {
      keyHint = "(unreadable — re-enter key)";
    }

    return ok({
      configured: true,
      provider: config.provider,
      chatModel: config.chatModel,
      embeddingModel: config.embeddingModel,
      apiBaseUrl: config.apiBaseUrl,
      embeddingDimension: config.embeddingDimension,
      apiKeyHint: keyHint,
      updatedAt: config.updatedAt,
    });
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}

/**
 * Create or update the project's LLM config (Bring Your Own Key). The key is
 * encrypted at rest. If the embedding model/provider/dimension changes and the
 * project already has indexed chunks, those chunks are wiped because their
 * vector dimension would no longer match — the content must be re-indexed.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return fail("Project not found", 404);

    const body = await req.json().catch(() => null);
    const parsed = llmConfigSchema.safeParse(body);
    if (!parsed.success) return fail(formatZodError(parsed.error), 400);
    const input = parsed.data;

    const embeddingDimension =
      input.embeddingDimension ?? DEFAULT_DIMENSION[input.provider] ?? 768;

    const existing = await prisma.projectLlmConfig.findUnique({
      where: { projectId: params.id },
    });

    // Detect a change that would invalidate already-stored embeddings.
    const embeddingChanged =
      !!existing &&
      (existing.provider !== input.provider ||
        existing.embeddingModel !== input.embeddingModel ||
        existing.embeddingDimension !== embeddingDimension);

    let reindexRequired = false;
    if (embeddingChanged) {
      const chunkCount = await prisma.documentChunk.count({
        where: { projectId: params.id },
      });
      if (chunkCount > 0) {
        // Wipe documents + chunks so the project re-indexes with the new model.
        await prisma.document.deleteMany({ where: { projectId: params.id } });
        reindexRequired = true;
      }
    }

    const data = {
      provider: input.provider,
      apiKeyEncrypted: encryptSecret(input.apiKey),
      chatModel: input.chatModel,
      embeddingModel: input.embeddingModel,
      apiBaseUrl: input.apiBaseUrl ?? null,
      embeddingDimension,
    };

    await prisma.projectLlmConfig.upsert({
      where: { projectId: params.id },
      create: { projectId: params.id, ...data },
      update: data,
    });

    return ok({ configured: true, reindexRequired }, existing ? 200 : 201);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}

/** Alias POST to PUT for convenience. */
export const POST = PUT;
