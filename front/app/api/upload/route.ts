import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";
const UPLOAD_PROXY_TIMEOUT_MS = 55000;

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
        ? "Inventory detection timed out. Try one clear photo at a time."
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
