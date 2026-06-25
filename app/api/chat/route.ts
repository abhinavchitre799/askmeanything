import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/http";
import { chatRequestSchema, formatZodError } from "@/lib/validation";
import { generateAnswer } from "@/lib/answer";

export const runtime = "nodejs";

/** Add permissive CORS headers so the embeddable widget can call cross-origin. */
function withCors<T extends NextResponse>(res: T): T {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

/** CORS preflight. */
export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * POST /api/chat   visitor-facing Q&A endpoint. Errors are kept generic so we
 * never leak internals to anonymous visitors. No lead/contact info is collected.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(fail(formatZodError(parsed.error), 400));
    }
    const { projectId, messages } = parsed.data;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return withCors(fail("Unknown project", 404));
    }

    const visitorId = parsed.data.visitorId || randomUUID();

    // The latest user-authored message, falling back to the last message.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const content = (lastUser ?? messages[messages.length - 1])?.content?.trim();
    if (!content) {
      return withCors(fail("No question provided", 400));
    }

    // Reuse the most recent conversation for this visitor, else start one.
    let conversation = await prisma.conversation.findFirst({
      where: { projectId, visitorId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { projectId, visitorId },
        select: { id: true },
      });
    }
    const conversationId = conversation.id;

    await prisma.message.create({
      data: { conversationId, role: "user", content },
    });

    // An empty knowledge base is NOT an error: generateAnswer returns a safe
    // fallback (usedContext:false) which we relay as a normal 200.
    const { answer, sources } = await generateAnswer({
      projectId,
      question: content,
    });

    await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: answer,
        // Cast: Prisma's Json input type doesn't accept a typed object array directly.
        sourcesJson: sources as unknown as Prisma.InputJsonValue,
      },
    });

    // Touch conversation so updatedAt reflects the latest activity.
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {},
    });

    return withCors(
      NextResponse.json({ answer, sources, conversationId }, { status: 200 })
    );
  } catch (err) {
    // Log server-side; return a safe generic message to the visitor.
    console.error("[chat] failed to answer question", err);
    return withCors(
      fail("Sorry, something went wrong answering your question.", 500)
    );
  }
}
