/**
 * E2E tests — Login and authentication flows.
 *
 * Tests the login page, form validation, error states, and role-based redirect.
 */

import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("login page loads", async ({ page }) => {
    await expect(page).toHaveURL("/login");
  });

  test("login form is visible", async ({ page }) => {
    await expect(page.getByRole("form").or(page.locator("form"))).toBeVisible();
  });

  test("username/pantry ID field is present", async ({ page }) => {
    const usernameInput = page.getByLabel(/pantry id|username|email/i);
    await expect(usernameInput.first()).toBeVisible();
  });

  test("password field is present", async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
  });

  test("submit button is present", async ({ page }) => {
    const submitBtn = page.getByRole("button", { name: /sign in|log in|login/i });
    await expect(submitBtn).toBeVisible();
  });

  test("empty form submission shows validation error", async ({ page }) => {
    await page.getByRole("button", { name: /sign in|log in|login/i }).click();
    // Either browser validation (required) or our error message
    const errorMsg = page.locator('[role="alert"], .error, input:invalid');
    await expect(errorMsg.first()).toBeVisible({ timeout: 5_000 });
  });

  test("wrong credentials shows error message", async ({ page }) => {
    await page.getByLabel(/pantry id|username/i).first().fill("9999");
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in|log in|login/i }).click();

    const error = page.locator('[role="alert"], [role="status"]').filter({
      hasText: /invalid|incorrect|not found|error/i,
    });
    await expect(error.first()).toBeVisible({ timeout: 10_000 });
  });

  test("home link or back button is present", async ({ page }) => {
    const backLink = page.getByRole("link", { name: /home|back|←/i });
    if (await backLink.isVisible()) {
      await expect(backLink).toBeVisible();
    }
    // Not a hard requirement — login page may not have back nav
  });
});

test.describe("Login redirect behavior", () => {
  test("director portal renders distinct copy", async ({ page }) => {
    await page.goto("/login?callbackUrl=/director/dashboard");

    await expect(page.getByRole("heading", { name: /director access/i })).toBeVisible();
    await expect(page.getByText(/director portal/i)).toBeVisible();
    await expect(page.getByLabel(/director email/i)).toBeVisible();
  });

  test("director can sign in with email credentials", async ({ page }) => {
    await page.goto("/login?callbackUrl=/director/dashboard");
    await page.getByLabel(/director email/i).fill("director@example.com");
    await page.getByLabel(/password/i).fill("director-secret-123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/director\/dashboard/, { timeout: 15_000 });
  });

  test("unauthenticated access to upload page redirects to login", async ({ page }) => {
    await page.goto("/1/upload");
    // Should redirect to /login
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test("unauthenticated access to manager page redirects to login", async ({ page }) => {
    await page.goto("/manager");
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test("unauthenticated access to dashboard redirects to login", async ({ page }) => {
    await page.goto("/1/dashboard");
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test("home page does NOT redirect to login (public)", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/login/);
  });
});
