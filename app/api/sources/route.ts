import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, safeMessage } from "@/lib/http";
import { createSourceSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /api/sources    create a knowledge source for a project.
 * GET  /api/sources?projectId=...   list a project's sources + latest crawl job.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSourceSchema.safeParse(body);
    if (!parsed.success) {
      return fail(formatZodError(parsed.error), 400);
    }
    const { projectId, type, url, title } = parsed.data;

    if ((type === "website" || type === "sitemap") && !url) {
      return fail(`url is required for ${type} sources`, 400);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return fail("Project not found", 404);
    }

    const source = await prisma.source.create({
      data: {
        projectId,
        type,
        url: url ?? null,
        title: title ?? null,
        status: "pending",
      },
    });

    return ok(source, 201);
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

    const sources = await prisma.source.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        crawlJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return ok(sources);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}
