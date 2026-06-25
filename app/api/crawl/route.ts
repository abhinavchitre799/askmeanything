import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, safeMessage } from "@/lib/http";
import { createCrawlSchema, formatZodError } from "@/lib/validation";
import { runCrawl } from "@/lib/crawler";

export const runtime = "nodejs";

/**
 * POST /api/crawl   queue a crawl for a source and kick it off.
 * GET  /api/crawl?projectId=...   list recent crawl jobs.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createCrawlSchema.safeParse(body);
    if (!parsed.success) {
      return fail(formatZodError(parsed.error), 400);
    }
    const { projectId, sourceId } = parsed.data;

    // Verify the source exists and belongs to the given project.
    const source = await prisma.source.findFirst({
      where: { id: sourceId, projectId },
      select: { id: true },
    });
    if (!source) {
      return fail("Source not found for project", 404);
    }

    const job = await prisma.crawlJob.create({
      data: { projectId, sourceId, status: "queued" },
      select: { id: true },
    });
    const jobId = job.id;

    // TODO(production): replace this fire-and-forget call with a real job queue
    // (e.g. BullMQ / a worker). Running in-process means the crawl dies if the
    // serverless function is recycled. For the MVP we intentionally do NOT await.
    void runCrawl({ projectId, sourceId, jobId }).catch(async (err) => {
      await prisma.crawlJob
        .update({
          where: { id: jobId },
          data: {
            status: "failed",
            errorMessage: safeMessage(err),
            finishedAt: new Date(),
          },
        })
        .catch(() => {
          /* best-effort: nothing more we can safely do here */
        });
    });

    return ok({ jobId, status: "queued" }, 202);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return fail("projectId query parameter is required", 400);
    }

    const jobs = await prisma.crawlJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return ok(jobs);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}
