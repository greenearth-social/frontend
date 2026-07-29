import { test, expect } from "@playwright/test";

test.describe("Feed Page", () => {
  test.beforeEach(async ({ page }) => {
    let pageError: string | null = null;
    page.on("pageerror", (err) => {
      pageError = err.message;
    });

    await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });

    await Promise.race([
      page.waitForSelector("feed-item-card", { timeout: 10000 }),
      new Promise<void>((_, reject) => {
        const check = () => {
          if (pageError) reject(new Error(`Page error: ${pageError}`));
          else setTimeout(check, 100);
        };
        check();
      }),
    ]);
  });

  test("shows feed title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Why Am I Seeing This?");
  });

  test("shows all feed cards (default per page is 10)", async ({ page }) => {
    await expect(page.locator("feed-item-card")).toHaveCount(6);
  });

  test("shows Open in Bluesky link on first card", async ({ page }) => {
    const firstCard = page.locator("feed-item-card").first();
    await expect(firstCard.locator(".bluesky-btn")).toBeVisible();
  });

  test("shows rank scores chart on first card", async ({ page }) => {
    const firstCard = page.locator("feed-item-card").first();
    await expect(firstCard.locator("rank-scores-chart")).toBeVisible();
  });

  test("shows signed-in user in sidebar", async ({ page }) => {
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toContainText("@Mock User");
  });

  test("shows Why Am I seeing this? header", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Why Am I Seeing This?");
  });

  test("shows feeds card in right sidebar", async ({ page }) => {
    const feeds = page.locator("right-sidebar");
    await expect(feeds).toContainText("Feeds");
  });
});
