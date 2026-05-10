/******************************** route.ts ***************************************
 *
 *  Module: Frontend API Route
 *
 *  This module proxies frontend requests to backend services and
 *  authentication handlers.
 *
 *  The module provides:
 *
 *  - Next.js route handlers for browser requests.
 *  - backend API forwarding with consistent response handling.
 *
 *  Key Structures Used:
 *
 *  - Next.js route modules, request objects, and response payloads.
 *
 *  This module ensures:
 *
 *  - frontend calls stay behind a stable local API path.
 *  - backend errors are surfaced in a predictable shape.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";
const UPLOAD_PROXY_TIMEOUT_MS = 110000;

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_PROXY_TIMEOUT_MS);
  try {
    const formData = await request.formData();
    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { ok: false, error: text || "Upload failed." };
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Inventory detection timed out. Try fewer clear photos or retake blurry images."
        : error instanceof Error
          ? error.message
          : "Network error while uploading files.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
