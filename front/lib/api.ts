/******************************** api.ts ***************************************
 *
 *  Module: Api
 *
 *  This module provides shared frontend helper logic for the application.
 *
 *  The module provides:
 *
 *  - utility functions imported by pages and components.
 *  - one place for repeated frontend behavior.
 *
 *  Key Structures Used:
 *
 *  - TypeScript exports and shared constants.
 *
 *  This module ensures:
 *
 *  - frontend logic avoids copy-paste drift.
 *  - pages can rely on typed helper functions.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
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
