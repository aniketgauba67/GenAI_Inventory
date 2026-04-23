/**
 * Returns the API base URL appropriate for the current execution context.
 * - Browser: uses NEXT_PUBLIC_API_URL (baked in at build time)
 * - Server (SSR/API routes): uses API_URL (runtime env var, never exposed to client)
 * - Falls back to localhost:8000 for local development
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  }
  return process.env.API_URL ?? "http://localhost:8000";
}
