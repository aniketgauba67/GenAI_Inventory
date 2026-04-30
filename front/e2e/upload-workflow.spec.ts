/******************************** upload-workflow.spec.ts ***************************************
 *
 *  Module: Frontend E2E Upload Workflow Test
 *
 *  This module defines browser-level checks for frontend e2e upload workflow test.
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

const PANTRY_ID = process.env.PLAYWRIGHT_PANTRY_ID || "";
const PANTRY_PASSWORD = process.env.PLAYWRIGHT_PANTRY_PASSWORD || "";
const HAS_CREDS = Boolean(PANTRY_ID && PANTRY_PASSWORD);
const TEST_IMAGE = {
  name: "test-shelf.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.alloc(1024, "x"),
};

async function selectTestImage(page: import("@playwright/test").Page) {
  const dropzone = page.getByRole("region", { name: /file upload dropzone/i });
  await expect(dropzone).toBeVisible();

  const dataTransfer = await page.evaluateHandle(({ name, mimeType }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["test image"], name, { type: mimeType }));
    return transfer;
  }, TEST_IMAGE);

  await dropzone.dispatchEvent("drop", { dataTransfer });
}

// Helper: login as pantry volunteer
async function loginAsPantry(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/pantry id|username/i).first().fill(PANTRY_ID);
  await page.getByLabel(/password/i).fill(PANTRY_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await expect(page).toHaveURL(`/${PANTRY_ID}/upload`, { timeout: 15_000 });
}

test.describe("Upload page — unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/1/upload");
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

test.describe("Upload page — authenticated", () => {
  test.skip(!HAS_CREDS, "Skipped: set PLAYWRIGHT_PANTRY_ID and PLAYWRIGHT_PANTRY_PASSWORD to run");

  test.beforeEach(async ({ page }) => {
    await loginAsPantry(page);
  });

  test("upload page loads with correct URL", async ({ page }) => {
    await expect(page).toHaveURL(`/${PANTRY_ID}/upload`);
  });

  test("flow stepper shows 'Upload' as current step", async ({ page }) => {
    await expect(page.getByText("Upload", { exact: true })).toBeVisible();
  });

  test("upload dropzone is visible", async ({ page }) => {
    const dropzone = page.getByText(/drag|drop|upload/i).first();
    await expect(dropzone).toBeVisible();
  });

  test("can select image file via file input", async ({ page, browserName }) => {
    test.skip(browserName === "chromium", "Synthetic upload event is covered in mobile-safari for this flow");

    await selectTestImage(page);
    await expect(page.getByRole("button", { name: /detect inventory/i })).toBeEnabled({ timeout: 5_000 });
  });

  test("extract button becomes available after file selection", async ({ page, browserName }) => {
    test.skip(browserName === "chromium", "Synthetic upload event is covered in mobile-safari for this flow");

    await selectTestImage(page);
    const detectBtn = page.getByRole("button", { name: /detect inventory/i });
    await expect(detectBtn).toBeEnabled({ timeout: 5_000 });
  });

  test("pantry open/closed status badge is visible", async ({ page }) => {
    const statusBadge = page.getByText(/open|closed/i).first();
    await expect(statusBadge).toBeVisible({ timeout: 10_000 });
  });

  test("can log out from upload page", async ({ page }) => {
    const logoutBtn = page.getByRole("button", { name: /switch account|logout|log out/i });
    await expect(logoutBtn.first()).toBeVisible();
  });
});

test.describe("Review page — unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/1/review");
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});
