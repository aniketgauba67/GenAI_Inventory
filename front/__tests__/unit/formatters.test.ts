/******************************** formatters.test.ts ***************************************
 *
 *  Module: Frontend Unit Formatters Test
 *
 *  This module defines automated frontend checks for frontend unit formatters test.
 *
 *  The module provides:
 *
 *  - Jest tests for UI components, API helpers, mocks, or integration paths.
 *  - assertions for rendering, accessibility, interactions, and error states.
 *  - regression coverage for customer, volunteer, and manager workflows.
 *
 *  Key Structures Used:
 *
 *  - Jest, React Testing Library, mock service workers, and shared fixtures.
 *
 *  This module ensures:
 *
 *  - frontend behavior stays predictable across refactors.
 *  - user-facing states remain covered by repeatable automated tests.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
function formatRelativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

describe("formatRelativeTime", () => {
  const now = Date.now();

  it("returns 'just now' for timestamps less than 2 minutes ago", () => {
    const ts = new Date(now - 60_000).toISOString();       // 1 min ago
    expect(formatRelativeTime(ts)).toBe("just now");
  });

  it("returns 'just now' for the current instant", () => {
    const ts = new Date(now).toISOString();
    expect(formatRelativeTime(ts)).toBe("just now");
  });

  it("returns minutes for 2–59 minutes ago", () => {
    const ts = new Date(now - 15 * 60_000).toISOString();  // 15 min ago
    expect(formatRelativeTime(ts)).toBe("15m ago");
  });

  it("returns minutes for exactly 59 minutes", () => {
    const ts = new Date(now - 59 * 60_000).toISOString();
    expect(formatRelativeTime(ts)).toBe("59m ago");
  });

  it("returns hours for 1–23 hours ago", () => {
    const ts = new Date(now - 3 * 60 * 60_000).toISOString();  // 3 hrs ago
    expect(formatRelativeTime(ts)).toBe("3h ago");
  });

  it("returns hours for exactly 23 hours", () => {
    const ts = new Date(now - 23 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(ts)).toBe("23h ago");
  });

  it("returns days for 24+ hours ago", () => {
    const ts = new Date(now - 24 * 60 * 60_000).toISOString();  // 1 day
    expect(formatRelativeTime(ts)).toBe("1d ago");
  });

  it("returns days for multiple days", () => {
    const ts = new Date(now - 5 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(ts)).toBe("5d ago");
  });

  it("handles future timestamps gracefully (returns 'just now')", () => {
    const ts = new Date(now + 60_000).toISOString();  // 1 minute in future
    expect(formatRelativeTime(ts)).toBe("just now");  // mins < 2
  });
});


// ── Operating hours display helpers (inline logic extracted from page.tsx) ────

describe("time window helpers", () => {
  const DAY_LABELS: Record<string, string> = {
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
    fri: "Fri", sat: "Sat", sun: "Sun",
  };

  it("maps all 7 day codes to short labels", () => {
    const expected = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const result = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
      .map((d) => DAY_LABELS[d]);
    expect(result).toEqual(expected);
  });

  it("undefined day key returns undefined (not found)", () => {
    expect(DAY_LABELS["monday"]).toBeUndefined();
  });
});
