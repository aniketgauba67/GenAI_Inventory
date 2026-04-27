/**
 * Shared test fixtures for the frontend test suite.
 *
 * Import from any test file:  import { mockPantry, mockLevels } from "../fixtures";
 */

export const INVENTORY_CATEGORIES = [
  "Beverages", "Juices", "Cereal", "Breakfast", "Meat", "Fish",
  "Poultry", "Frozen", "Vegetables", "Fruits", "Nuts", "Soup",
  "Grains", "Pasta", "Snacks", "Spices", "Sauces", "Condiments",
  "Misc Products",
] as const;

export type Category = (typeof INVENTORY_CATEGORIES)[number];
export type Level = "High" | "Mid" | "Low" | "Out";

export const makeLevels = (level: Level = "Mid"): Record<string, Level> =>
  Object.fromEntries(INVENTORY_CATEGORIES.map((c) => [c, level]));

export const makeQuantities = (qty = 100): Record<string, number> =>
  Object.fromEntries(INVENTORY_CATEGORIES.map((c) => [c, qty]));

// ── Pantry fixtures ──────────────────────────────────────────────────────────

export const mockPantryOpen = {
  pantryId: "1",
  name: "FPN Pantry A",
  location: "10 Maple Ave, New York, NY",
  isOpen: true,
  manualOverride: false,
  operatingHours: [
    { day: "mon", open: "09:00", close: "17:00" },
    { day: "wed", open: "09:00", close: "17:00" },
  ],
  levels: makeLevels("High"),
  originalQuantities: makeQuantities(100),
  lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
};

export const mockPantryClosed = {
  pantryId: "2",
  name: "FPN Pantry B",
  location: "22 Oak Rd, Brooklyn, NY",
  isOpen: false,
  manualOverride: true,
  operatingHours: [],
  levels: makeLevels("Low"),
  originalQuantities: makeQuantities(50),
  lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
};

export const mockPantryNoInventory = {
  pantryId: "3",
  name: "FPN Pantry C",
  location: null,
  isOpen: true,
  manualOverride: false,
  operatingHours: [],
  levels: makeLevels("Out"),
  originalQuantities: makeQuantities(0),
  lastUpdated: null,
};

export const mockPantries = [mockPantryOpen, mockPantryClosed, mockPantryNoInventory];

// ── API response fixtures ─────────────────────────────────────────────────────

export const apiPantriesOk = { ok: true, pantries: mockPantries };
export const apiPantriesEmpty = { ok: true, pantries: [] };
export const apiPantriesError = { ok: false, error: "DB unreachable", pantries: [] };

export const apiChatReply = (message: string) => ({
  ok: true,
  reply: `Mock reply to: "${message}"`,
});
export const apiChatError = { ok: false, error: "Chatbot unavailable." };

// ── Category group fixtures ───────────────────────────────────────────────────

export const categoryGroupValues: Record<string, number> = Object.fromEntries(
  INVENTORY_CATEGORIES.map((c, i) => [c, i * 5]),
);
