/**
 * Zod schemas + helpers for request validation across API routes.
 * Keeps validation logic in one place and out of route handlers.
 */
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "name is required").max(120),
  domain: z.string().max(255).optional(),
  organizationName: z.string().min(1).max(120).optional(),
});

export const createSourceSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  type: z.enum(["website", "sitemap", "upload", "manual"]),
  url: z.string().url("url must be a valid URL").optional(),
  title: z.string().max(255).optional(),
});

export const createCrawlSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  sourceId: z.string().min(1, "sourceId is required"),
});

export const chatRequestSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  visitorId: z.string().min(1).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1, "at least one message is required"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type CreateCrawlInput = z.infer<typeof createCrawlSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

/** Format a ZodError into a single human-readable string. */
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((e) => `${e.path.join(".") || "body"}: ${e.message}`)
    .join("; ");
}
