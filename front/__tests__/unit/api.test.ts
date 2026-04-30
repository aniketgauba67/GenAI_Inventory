/******************************** api.test.ts ***************************************
 *
 *  Module: Frontend Unit Api Test
 *
 *  This module defines automated frontend checks for frontend unit api test.
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
import { getApiBase } from "@/lib/api";

const ORIGINAL_NEXT_PUBLIC = process.env.NEXT_PUBLIC_API_URL;
const ORIGINAL_API_URL = process.env.API_URL;

afterEach(() => {
  // Restore env vars after each test
  if (ORIGINAL_NEXT_PUBLIC !== undefined) {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_NEXT_PUBLIC;
  } else {
    delete process.env.NEXT_PUBLIC_API_URL;
  }
  if (ORIGINAL_API_URL !== undefined) {
    process.env.API_URL = ORIGINAL_API_URL;
  } else {
    delete process.env.API_URL;
  }
});

describe("getApiBase", () => {
  describe("browser environment (window defined)", () => {
    it("returns NEXT_PUBLIC_API_URL when set", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
      expect(getApiBase()).toBe("https://api.example.com");
    });

    it("returns localhost fallback when NEXT_PUBLIC_API_URL is not set", () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      expect(getApiBase()).toBe("http://localhost:8000");
    });

    it("trims nothing — returns exact env value", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.prod.com";
      expect(getApiBase()).toBe("https://api.prod.com");
    });
  });

  // Note: in the Jest jsdom environment, window IS defined, so the server-side
  // branch (API_URL) is not reachable from test code. Test it indirectly.
  it("returns a non-empty string", () => {
    const base = getApiBase();
    expect(typeof base).toBe("string");
    expect(base.length).toBeGreaterThan(0);
  });

  it("returns a URL that starts with http", () => {
    const base = getApiBase();
    expect(base).toMatch(/^https?:\/\//);
  });
});
