/**
 * @jest-environment node
 *
 * Integration tests for the Next.js /api/chat proxy route.
 *
 * Uses node environment so that the Fetch API globals (Request, Response)
 * are available — they are not polyfilled in jsdom for Next.js route handlers.
 *
 * These tests call the route handler directly (not via HTTP) to verify the
 * request validation, response shaping, and downstream forwarding logic.
 */

import { POST } from "@/app/api/chat/route";

// Helper to create a NextRequest-compatible mock
function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Mock the global fetch so the route handler doesn't make real HTTP calls
const mockFetch = jest.fn();

beforeAll(() => {
  process.env.API_URL = "http://localhost:8000";
  global.fetch = mockFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
  // Default: backend returns a successful chat reply
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, reply: "Mock bot reply" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

describe("POST /api/chat", () => {
  it("rejects empty message with 400", async () => {
    const req = makeRequest({ message: "", history: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/empty/i);
  });

  it("rejects whitespace-only message with 400", async () => {
    const req = makeRequest({ message: "   ", history: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("forwards message to backend and returns reply", async () => {
    const req = makeRequest({ message: "What pantries are open?", history: [] });
    const res = await POST(req);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.reply).toBe("string");
    expect(data.reply.length).toBeGreaterThan(0);
  });

  it("forwards history array to backend", async () => {
    const req = makeRequest({
      message: "Follow up question",
      history: [["user", "prev"], ["assistant", "reply"]],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("forwards pantryId to backend when provided", async () => {
    const req = makeRequest({
      message: "What is in stock at pantry 1?",
      pantryId: "1",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Verify fetch was called with the pantry_id in the request body
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchedBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchedBody.pantry_id).toBe("1");
  });

  it("sends pantry_id=null when pantryId not provided", async () => {
    const req = makeRequest({ message: "General question" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const fetchedBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchedBody.pantry_id).toBeNull();
  });

  it("forwards userLocation to backend when provided", async () => {
    const req = makeRequest({
      message: "closest pantry near me",
      userLocation: {
        latitude: 40.02,
        longitude: -82.44,
        accuracy: 25,
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const fetchedBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchedBody.user_location).toEqual({
      latitude: 40.02,
      longitude: -82.44,
      accuracy: 25,
    });
  });

  it("returns ok:true and reply when backend succeeds", async () => {
    const req = makeRequest({ message: "Hello bot" });
    const res = await POST(req);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reply).toBeTruthy();
  });

  it("handles backend error response gracefully", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "Gemini failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const req = makeRequest({ message: "trigger error" });
    const res = await POST(req);
    expect(res.status).not.toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});
