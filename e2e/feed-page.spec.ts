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

  test("shows all feed cards (default per page is 20)", async ({ page }) => {
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

  test("does not show a manual feed refresh control", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Refresh feed history" })).toHaveCount(0);
  });

  test("does not duplicate the feed selector in a right sidebar", async ({ page }) => {
    await expect(page.locator("right-sidebar")).toHaveCount(0);
  });
});

test.describe("OAuth failure recovery", () => {
  test("returns cancellation to the login form", async ({ page }) => {
    await page.goto(
      "/#/auth/finish?error=access_denied&error_description=raw-provider-description",
      { waitUntil: "domcontentloaded" },
    );

    await expect(page).toHaveURL(/#\/feed$/);
    await expect(page.getByRole("alert")).toContainText("Sign in was canceled");
    await expect(page.getByLabel("Account handle")).toBeVisible();
    expect(page.url()).not.toContain("raw-provider-description");
  });
});
