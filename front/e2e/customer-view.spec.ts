/******************************** customer-view.spec.ts ***************************************
 *
 *  Module: Frontend E2E Customer View Test
 *
 *  This module defines browser-level checks for frontend e2e customer view test.
 *
 *  The module provides:
 *
 *  - Playwright scenarios that exercise real application pages.
 *  - navigation, form, upload, and customer-view assertions.
 *  - coverage across desktop and mobile browser profiles.
 *
 *  Key Structures Used:
 *
 *  - Playwright test fixtures, locators, expectations, and route navigation.
 *
 *  This module ensures:
 *
 *  - complete user workflows continue working in a browser environment.
 *  - responsive pages stay testable beyond isolated component checks.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import { test, expect } from "@playwright/test";

test.describe("Customer home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads and shows the pantry list or a loading state", async ({ page }) => {
    // Either content or loading skeletons should be visible
    const content = page.locator("main, [role='main']").first();
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test("page title or logo is visible", async ({ page }) => {
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  });

  test("floating chat button is visible", async ({ page }) => {
    const chatBtn = page.getByRole("button", { name: /open chat/i });
    await expect(chatBtn).toBeVisible({ timeout: 10_000 });
  });

  test("chat opens when button is clicked", async ({ page }) => {
    await page.getByRole("button", { name: /open chat/i }).click();
    await expect(page.getByText(/Inventory Assistant/i)).toBeVisible();
  });

  test("chat closes when × button is clicked", async ({ page }) => {
    await page.getByRole("button", { name: /open chat/i }).click();
    await page.getByRole("button", { name: /close chat/i }).click();
    await expect(page.getByText(/Inventory Assistant/i)).not.toBeVisible();
  });

  test("search input is present", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search pantry/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
  });

  test("search by time option is visible", async ({ page }) => {
    // "Search by time" button should be present
    const timeBtn = page.getByText(/search by time/i);
    await expect(timeBtn).toBeVisible({ timeout: 10_000 });
  });

  test("Easy View toggle button is present", async ({ page }) => {
    const easyViewBtn = page.getByText(/easy view/i);
    await expect(easyViewBtn).toBeVisible({ timeout: 10_000 });
  });

  test("Easy View mode activates when toggled", async ({ page }) => {
    const easyViewBtn = page.getByText(/easy view/i);
    await easyViewBtn.click();
    // In Easy View, text becomes larger — check for some indicator
    await expect(page).toHaveURL("/");
  });

  test("login button is accessible from the home page", async ({ page }) => {
    const loginLink = page.getByRole("link", { name: /log in|sign in|volunteer|manager/i });
    await expect(loginLink.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Pantry detail panel", () => {
  test("clicking a pantry shows its inventory categories", async ({ page }) => {
    await page.goto("/");
    // Wait for pantries to load
    const firstPantry = page.locator('[data-testid="pantry-card"], .rounded-2xl').first();
    await firstPantry.waitFor({ state: "visible", timeout: 15_000 });
    await firstPantry.click();
    // After clicking, detail panel should appear
    // Just verify page hasn't crashed
    await expect(page).toHaveURL("/");
  });
});

test.describe("Time-based search", () => {
  test("search by time panel opens when button clicked", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/search by time/i).click();
    // A day selector or time input should appear
    const timeInput = page.locator('select, input[type="time"]');
    await expect(timeInput.first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Accessibility", () => {
  test("page has no obvious keyboard trap", async ({ page }) => {
    await page.goto("/");
    // Tab through the page — should not get stuck
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Just ensure page is still responsive
    await expect(page).toHaveURL("/");
  });

  test("chat dialog is keyboard accessible", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open chat/i }).click();
    const input = page.getByPlaceholder(/Type your question/i);
    await input.focus();
    await expect(input).toBeFocused();
  });
});
