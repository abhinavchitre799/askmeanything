import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, safeMessage } from "@/lib/http";
import { extractTextFromUpload, ingestText } from "@/lib/documents";

export const runtime = "nodejs";

/**
 * POST /api/upload   accept a multipart file upload, extract its text, and
 * ingest it into the project's knowledge base.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const projectId = form.get("projectId");
    const file = form.get("file");

    if (typeof projectId !== "string" || !projectId) {
      return fail("projectId is required", 400);
    }
    if (!(file instanceof File)) {
      return fail("file is required", 400);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return fail("Project not found", 404);
    }

    // One Source per upload for the MVP.
    const source = await prisma.source.create({
      data: {
        projectId,
        type: "upload",
        title: file.name,
        status: "ready",
        lastSyncedAt: new Date(),
      },
      select: { id: true },
    });

    const buffer = Buffer.from(await file.arrayBuffer());

    let text: string;
    try {
      text = await extractTextFromUpload({
        fileName: file.name,
        mimeType: file.type,
        buffer,
      });
    } catch (err) {
      // Extraction failures are client-fixable (bad/unsupported file) -> 400.
      await prisma.source
        .update({ where: { id: source.id }, data: { status: "error" } })
        .catch(() => {});
      return fail(safeMessage(err), 400);
    }

    if (!text.trim()) {
      await prisma.source
        .update({ where: { id: source.id }, data: { status: "error" } })
        .catch(() => {});
      return fail("No text could be extracted", 400);
    }

    const { documentId, chunkCount } = await ingestText({
      projectId,
      sourceId: source.id,
      title: file.name,
      url: null,
      fileName: file.name,
      text,
    });

    await prisma.source.update({
      where: { id: source.id },
      data: { status: "ready", lastSyncedAt: new Date() },
    });

    return ok({ sourceId: source.id, documentId, chunkCount }, 201);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}
