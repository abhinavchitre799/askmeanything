import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, safeMessage } from "@/lib/http";
import { createProjectSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /api/projects
 * Create a project under the (single-tenant MVP) organization, plus default
 * widget settings. GET lists projects with source/document counts.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return fail(formatZodError(parsed.error), 400);
    }
    const { name, domain, organizationName } = parsed.data;

    // MVP single-tenant: reuse the first organization if one exists.
    const existingOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const organizationId =
      existingOrg?.id ??
      (
        await prisma.organization.create({
          data: { name: organizationName || "Default Org" },
          select: { id: true },
        })
      ).id;

    const project = await prisma.project.create({
      data: {
        organizationId,
        name,
        domain: domain ?? null,
        widgetSettings: { create: {} },
      },
    });

    return ok(project, 201);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sources: true, documents: true } } },
    });
    return ok(projects);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}
