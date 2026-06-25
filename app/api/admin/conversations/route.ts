import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, safeMessage } from "@/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/admin/conversations?projectId=...
 * List a project's conversations (most recent first) with a message count and
 * a preview of the first user message.
 */
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return fail("projectId query parameter is required", 400);
    }

    const conversations = await prisma.conversation.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        _count: { select: { messages: true } },
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
      },
    });

    // Flatten the first-user-message into a `preview` field.
    const result = conversations.map((c) => {
      const { messages, ...rest } = c;
      return { ...rest, preview: messages[0]?.content ?? null };
    });

    return ok(result);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}
