import { expect, test } from "@playwright/test";

test.describe("feed-scoped navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/#\/feed\/your-feed$/);
  });

  test("navigates within feed groups and remembers the last feed", async ({ page }) => {
    const desktop = page.locator(".left-sidebar-desktop");
    await desktop.getByRole("button", { name: "Expand Best of Friends pages" }).click();
    await desktop.locator('.algo-btn[aria-label="Best of Friends"]').click();
    await expect(page).toHaveURL(/#\/feed\/best-of-friends$/);
    await desktop.locator('a[href="#/settings/best-of-friends"]').click();

    await expect(page).toHaveURL(/#\/settings\/best-of-friends$/);
    await expect(page.locator("settings-page")).toBeVisible();
    await expect(
      desktop.locator('.nav-link[aria-current="page"]'),
    ).toHaveAttribute("href", "#/settings/best-of-friends");
    await expect(
      desktop.locator('.algo-btn[aria-label="Best of Friends"]'),
    ).toHaveAttribute("aria-pressed", "true");

    await desktop.locator('a[href="#/feedback/best-of-friends"]').click();
    await expect(page).toHaveURL(/#\/feedback\/best-of-friends$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/settings\/best-of-friends$/);
    await expect(page.locator("settings-page")).toBeVisible();

    await page.goto("/#/auth/finish?token=test-token&return_url=/settings");
    await expect(page).toHaveURL(/#\/settings\/best-of-friends$/);
    await expect(
      page.locator('.left-sidebar-desktop .algo-btn[aria-label="Best of Friends"]'),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("opens the same drawer from a nested Settings page", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 560 });
    await page.evaluate(() => {
      window.location.hash = "/settings/your-feed";
    });
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);
    await page.locator("settings-page").getByRole("button", { name: "Open navigation" }).click();

    await expect(page.locator(".drawer.open")).toBeVisible();
  });

  test("keeps desktop subpage labels on one line and shows logout", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    const desktop = page.locator(".left-sidebar-desktop");
    const whyLabel = desktop.locator('a[href="#/feed/your-feed"] .nav-label');
    const labelStyle = await whyLabel.evaluate((element) => ({
      clientHeight: element.clientHeight,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      whiteSpace: getComputedStyle(element).whiteSpace,
    }));
    expect(labelStyle.whiteSpace).toBe("nowrap");
    expect(labelStyle.clientHeight).toBeLessThan(labelStyle.fontSize * 1.75);

    await desktop.getByRole("button", { name: "More options" }).click();
    await expect(desktop.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("resets changed Settings controls to their defaults", async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = "/settings/your-feed";
    });
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);
    for (const name of [
      "Following amount",
      "Liked by Following amount",
      "Liked Authors/Topics amount",
      "Popular amount",
    ]) {
      await expect(page.getByRole("slider", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Friends", { exact: true })).toBeVisible();
    await expect(page.getByText("All", { exact: true })).toBeVisible();
    const following = page.getByRole("slider", {
      name: "Following amount",
      exact: true,
    });
    await following.evaluate((input) => {
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected a range input");
      input.value = "0.6";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const constructive = page.getByRole("slider", { name: "Constructive weight" });
    await constructive.evaluate((input) => {
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected a range input");
      input.value = "0.65";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const reset = page.getByRole("button", { name: "Reset settings to defaults" });
    await expect(reset).toBeEnabled();
    await reset.click();

    await expect(constructive).toHaveValue("0.5");
    await expect(following).toHaveValue("0.3");
    await expect(page.getByRole("slider", {
      name: "Liked by Following amount",
      exact: true,
    })).toHaveValue("0.2");
    await expect(page.getByRole("status")).toContainText(
      "Refresh your Bluesky feed to see updates",
    );
  });

  test("keeps the four-source Settings rail usable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.evaluate(() => {
      window.location.hash = "/settings/your-feed";
    });
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);

    const settings = page.locator("settings-page");
    const sourceRank = page.getByRole("slider", { name: "Source rank" });
    await expect(sourceRank).toBeVisible();
    await expect(sourceRank).toHaveAttribute("aria-valuemin", "0");
    await expect(sourceRank).toHaveAttribute("aria-valuemax", "4");

    await expect(page.getByRole("spinbutton", {
      name: "Following percentage",
      exact: true,
    })).toHaveValue("30");
    const networkLock = page.getByRole("button", {
      name: "Lock Liked by Following weight",
    });
    await networkLock.click();
    await expect(page.getByRole("button", {
      name: "Unlock Liked by Following weight",
    })).toHaveAttribute("aria-pressed", "true");
    await expect(sourceRank).toBeDisabled();
    await expect(page.getByRole("slider", {
      name: "Following amount",
      exact: true,
    })).toHaveAttribute("aria-valuemax", "0.8");
    const followingPercentage = page.getByRole("spinbutton", {
      name: "Following percentage",
      exact: true,
    });
    await followingPercentage.fill("40");
    await followingPercentage.press("Enter");
    await expect(followingPercentage).toHaveValue("40");
    await expect(page.getByRole("spinbutton", {
      name: "Liked by Following percentage",
    })).toHaveValue("20");

    await page.getByRole("button", {
      name: "Lock Liked Authors/Topics weight",
    }).click();
    await page.getByRole("button", { name: "Lock Popular weight" }).click();
    await expect(page.getByRole("slider", {
      name: "Following amount",
      exact: true,
    })).toBeDisabled();
    await expect(followingPercentage).toBeDisabled();
    await expect(followingPercentage).toHaveValue("40");
    await expect(page.getByRole("button", {
      name: "Lock Following weight",
    })).toBeDisabled();

    const centeredHelp = await settings.evaluate((element) => {
      const root = element.shadowRoot;
      const panel = root?.querySelector(".section-candidate")?.getBoundingClientRect();
      const help = root?.querySelector(".source-controls-help")?.getBoundingClientRect();
      return panel && help
        ? Math.abs(panel.left + panel.width / 2 - (help.left + help.width / 2))
        : null;
    });
    expect(centeredHelp).not.toBeNull();
    expect(centeredHelp ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);

    const overflow = await settings.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("keeps the mobile feed switcher mapped to the canonical feed route", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    const tabs = page.locator("feed-page feed-tabs");
    await tabs.locator(".algo-trigger").click();
    await tabs.getByRole("option", { name: "Best of Friends" }).click();

    await expect(page).toHaveURL(/#\/feed\/best-of-friends$/);
    await expect(tabs.locator(".algo-trigger")).toContainText("Best of Friends");
    await expect(tabs.locator(".tab")).toHaveCount(0);

    await tabs.locator(".algo-trigger").click();
    await tabs.getByRole("option", { name: "Random" }).click();
    await expect(page).toHaveURL(/#\/feed\/random$/);
    await expect(tabs.locator(".algo-trigger")).toContainText("Random");
  });
});

for (const width of [240, 320, 375]) {
  test(`mobile drawer fits without horizontal overflow at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 560 });
    await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/#\/feed\/your-feed$/);
    await page.locator("feed-page").getByRole("button", { name: "Open navigation" }).click();

    const drawer = page.locator(".drawer.open");
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? width).toBeLessThanOrEqual(width - 31.9);

    const close = drawer.getByRole("button", { name: "Close navigation" });
    const closeBox = await close.boundingBox();
    expect(closeBox).not.toBeNull();
    expect((closeBox?.x ?? 0) - (box?.x ?? 0)).toBeGreaterThan(
      (box?.width ?? 0) / 2,
    );
    await expect(close).toHaveCSS("border-top-style", "solid");

    const overflow = await drawer.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    await drawer.getByRole("button", { name: "Expand Best of Friends pages" }).click();
    await drawer.getByRole("button", { name: "Expand Random pages" }).click();
    const vertical = await drawer.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(vertical.overflowY).toBe("auto");
    expect(vertical.scrollHeight).toBeGreaterThanOrEqual(vertical.clientHeight);

    await drawer.getByRole("link", { name: "Settings" }).first().click();
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);
    await expect(drawer).toBeVisible();

    const name = drawer
      .locator(".user-details-name, .user-details-handle--primary")
      .first();
    await name.evaluate((element) => {
      element.textContent = "A very long display name that must not leave the drawer";
    });
    const truncation = await name.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      textOverflow: getComputedStyle(element).textOverflow,
      whiteSpace: getComputedStyle(element).whiteSpace,
    }));
    expect(truncation.textOverflow).toBe("ellipsis");
    expect(truncation.whiteSpace).toBe("nowrap");
    expect(truncation.scrollWidth).toBeGreaterThan(truncation.clientWidth);

    await page.mouse.click(width - 8, 20);
    await expect(drawer).not.toBeVisible();
  });
}
