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
    await expect(page.locator("h1")).toContainText("Post Observability");
  });

  test("shows 3 feed cards (default per page)", async ({ page }) => {
    await expect(page.locator("feed-item-card")).toHaveCount(3);
  });

  test("shows Open in Bluesky link on first card", async ({ page }) => {
    const firstCard = page.locator("feed-item-card").first();
    await expect(firstCard.locator("text=/Open in Bluesky/")).toBeVisible();
  });

  test("shows rank scores chart on first card", async ({ page }) => {
    const firstCard = page.locator("feed-item-card").first();
    await expect(firstCard.locator("rank-scores-chart")).toBeVisible();
  });

  test("shows signed-in user in sidebar", async ({ page }) => {
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toContainText("@Mock User");
  });

  test("shows Post Observability header", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Post Observability");
  });

  test("shows Why am I seeing this subtitle", async ({ page }) => {
    await expect(page.locator("text=/Why am I seeing this/")).toBeVisible();
  });

  test("shows feeds card in right sidebar", async ({ page }) => {
    const feeds = page.locator("right-sidebar");
    await expect(feeds).toContainText("Feeds");
  });
});
