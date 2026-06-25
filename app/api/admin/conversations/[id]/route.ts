import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, safeMessage } from "@/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/admin/conversations/:id
 * Load a single conversation with its full message transcript.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return fail("Conversation not found", 404);
    }

    return ok(conversation);
  } catch (err) {
    return fail(safeMessage(err), 500);
  }
}
