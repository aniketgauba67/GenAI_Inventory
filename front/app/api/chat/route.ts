import { NextResponse } from "next/server";

type ChatRequestPayload = {
  message?: string;
  history?: Array<["user" | "assistant", string]>;
  pantryId?: string | null;
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ChatRequestPayload;
    const message = payload.message?.trim();

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Message cannot be empty." },
        { status: 400 },
      );
    }

    const apiBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${apiBase}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: payload.history || [],
        pantry_id: payload.pantryId ?? null,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      reply?: string;
      error?: string;
    };

    if (!response.ok || !data.ok || !data.reply) {
      return NextResponse.json(
        { ok: false, error: data.error || "Could not fetch chatbot response." },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json({ ok: true, reply: data.reply });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unexpected chatbot proxy error." },
      { status: 500 },
    );
  }
}
