import { NextResponse } from "next/server";

/** Standard JSON success response. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Standard JSON error response. Never leaks secrets or raw internals. */
export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrap a route handler so thrown errors become safe 500s with logging,
 * instead of leaking stack traces to clients.
 */
export function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
