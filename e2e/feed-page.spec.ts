import { test, expect } from "@playwright/test";

test.describe("Feed Page", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");

    // In mock mode, the app auto-signs in and loads the feed.
    // Wait for the feed to render (or the sign-in button if auth fails).
    await page.waitForSelector("app-shell", { timeout: 10000 });

    // If the auth guard redirected to /auth/bluesky, the page would
    // reload the SPA there — still inside app-shell but not loading feed.
    // Check which state we landed in.
    const signInBtn = page.locator("button", { hasText: "Sign in with Bluesky" });
    if (await signInBtn.isVisible().catch(() => false)) {
      // Mock sign-in wasn't auto-detected — click the button to sign in.
      await signInBtn.click();
      // After clicking, the browser navigates to /auth/bluesky, loads
      // the SPA again, and sign-in completes automatically in mock mode.
      await page.waitForURL(/\/#\/feed/, { timeout: 10000 });
    }

    // Now the feed should be loading. Wait for feed items.
    await page.waitForSelector("feed-item-card", { timeout: 10000 });

    if (errors.length > 0) {
      console.error("Page errors:", errors);
    }
  });

  test("shows feed title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Your Feed");
  });

  test("shows 6 feed cards", async ({ page }) => {
    await expect(page.locator("feed-item-card")).toHaveCount(6);
  });

  test("displays generator badges", async ({ page }) => {
    const badges = page.locator("generator-badge");
    await expect(badges.first()).toBeVisible();
    await expect(badges.first()).toContainText("two_tower");
  });

  test("expands reason panel on toggle", async ({ page }) => {
    const toggleBtn = page.locator("feed-item-card button").first();
    await toggleBtn.click();
    const panel = page.locator("reason-panel").first();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Generators");
  });

  test("shows signed-in user in header", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toContainText("mock@example.com");
  });

  test("shows generated timestamp", async ({ page }) => {
    await expect(page.locator("text=/Generated at/")).toBeVisible();
  });

  test("recompute button is visible", async ({ page }) => {
    const recomputeBtn = page.locator("button", { hasText: "Recompute feed" });
    await expect(recomputeBtn).toBeVisible();
  });
});
