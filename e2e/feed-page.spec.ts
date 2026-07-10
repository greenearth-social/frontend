import { test, expect } from "@playwright/test";

test.describe("Feed Page", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
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
