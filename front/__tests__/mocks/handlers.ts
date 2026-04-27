/**
 * MSW request handlers — intercept fetch calls during Jest tests.
 *
 * Add new handlers here as new API routes are added to the project.
 * Import { server } from "./server" in tests that need per-test overrides.
 */

import { http, HttpResponse } from "msw";

const INVENTORY_CATEGORIES = [
  "Beverages", "Juices", "Cereal", "Breakfast", "Meat", "Fish",
  "Poultry", "Frozen", "Vegetables", "Fruits", "Nuts", "Soup",
  "Grains", "Pasta", "Snacks", "Spices", "Sauces", "Condiments",
  "Misc Products",
] as const;

const makeLevels = (level: "High" | "Mid" | "Low" | "Out" = "Mid") =>
  Object.fromEntries(INVENTORY_CATEGORIES.map((c) => [c, level]));

// Default mock pantry list
const MOCK_PANTRIES = [
  {
    pantryId: "1",
    name: "FPN Pantry A",
    location: "10 Maple Ave, New York, NY",
    isOpen: true,
    manualOverride: false,
    operatingHours: [{ day: "mon", open: "09:00", close: "17:00" }],
    levels: makeLevels("High"),
    originalQuantities: Object.fromEntries(INVENTORY_CATEGORIES.map((c) => [c, 100])),
    lastUpdated: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    pantryId: "2",
    name: "FPN Pantry B",
    location: "22 Oak Rd, Brooklyn, NY",
    isOpen: false,
    manualOverride: true,
    operatingHours: [],
    levels: makeLevels("Low"),
    originalQuantities: Object.fromEntries(INVENTORY_CATEGORIES.map((c) => [c, 50])),
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

export const handlers = [
  // ── Backend pass-through (when tested via the Next.js API route) ──────────

  http.post("http://localhost:8000/auth/login", async ({ request }) => {
    const body = await request.json() as { username: string; password: string };
    if (body.username === "director" && body.password === "director-secret") {
      return HttpResponse.json({
        ok: true,
        user: {
          id: "director",
          name: "Director",
          pantryId: "director",
          role: "director",
          email: "director@example.com",
        },
      });
    }
    if (body.username === "1" && body.password === "pantry-secret") {
      return HttpResponse.json({
        ok: true,
        user: { id: "1", name: "1", pantryId: "1", role: "pantry", email: null },
      });
    }
    return HttpResponse.json({ ok: false, error: "Invalid credentials." });
  }),

  http.get("http://localhost:8000/customer/pantries", () => {
    return HttpResponse.json({ ok: true, pantries: MOCK_PANTRIES });
  }),

  http.get("http://localhost:8000/customer/pantries-by-time", ({ request }) => {
    const url = new URL(request.url);
    const day = url.searchParams.get("day");
    const time = url.searchParams.get("time");
    if (!day || !time) {
      return HttpResponse.json({ ok: false, error: "Missing day or time", pantries: [] });
    }
    const open = MOCK_PANTRIES.filter((p) =>
      p.operatingHours.some((h) => h.day === day)
    );
    return HttpResponse.json({ ok: true, pantries: open });
  }),

  http.post("http://localhost:8000/chat/message", async ({ request }) => {
    const body = await request.json() as { message: string };
    if (!body.message?.trim()) {
      return HttpResponse.json({ ok: false, error: "Empty message." }, { status: 422 });
    }
    return HttpResponse.json({
      ok: true,
      reply: `Mock reply to: "${body.message}"`,
    });
  }),

  // ── Next.js internal /api/chat proxy ─────────────────────────────────────

  http.post("/api/chat", async ({ request }) => {
    const body = await request.json() as { message: string };
    if (!body.message?.trim()) {
      return HttpResponse.json({ ok: false, error: "Empty message." }, { status: 400 });
    }
    return HttpResponse.json({
      ok: true,
      reply: `Proxied reply for: "${body.message}"`,
    });
  }),

  // ── Categories ────────────────────────────────────────────────────────────

  http.get("http://localhost:8000/categories", () => {
    return HttpResponse.json({ categories: [...INVENTORY_CATEGORIES] });
  }),
];
