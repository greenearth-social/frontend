import { expect, test } from "@playwright/test";

async function openSettings(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/#\/feed\/your-feed$/);
  await page.evaluate(() => {
    window.location.hash = "/settings/your-feed";
  });
  await expect(page).toHaveURL(/#\/settings\/your-feed$/);
  await expect(page.locator("settings-feed-preview")).toBeAttached();
}

async function releaseFreshness(
  page: import("@playwright/test").Page,
  value: string,
): Promise<void> {
  await page.getByRole("slider", { name: "Time Window" }).evaluate((input, next) => {
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected a range input");
    input.value = next;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("desktop keeps current feed visible in an independently scrollable rail", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);

  const sidebar = page.locator(".left-sidebar-desktop");
  const sidebarToggle = sidebar.getByRole("button", { name: "Collapse navigation" });
  await expect(sidebarToggle).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "275px");
  expect(await sidebar.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );

  await sidebarToggle.click();
  await expect(sidebar).toHaveCSS("width", "72px");
  await expect(sidebar.getByRole("button", { name: "Expand navigation" })).toBeVisible();

  await sidebar.getByRole("button", { name: "Expand navigation" }).click();
  await expect(sidebar).toHaveCSS("width", "275px");

  const settings = page.locator("settings-page");
  await expect(settings.locator(".feed-column")).toBeVisible();
  await expect(settings.getByText("Current feed", { exact: true })).toBeVisible();
  await expect(settings.locator("settings-feed-preview .card")).toHaveCount(6);
  const paletteButton = settings.getByRole("button", { name: "Show post color legend" });
  await expect(paletteButton).toBeVisible();
  await expect(paletteButton).toHaveAttribute("title", "Post color legend");
  await expect(settings.locator('wa-icon[name="palette"]')).toBeVisible();
  await paletteButton.click();
  await expect(paletteButton).toHaveAttribute("aria-expanded", "true");
  const legend = settings.getByRole("region", { name: "Post color legend" });
  await expect(legend).toBeVisible();
  for (const label of [
    "Author/Topic",
    "Followed",
    "Followed Likes",
    "Popular",
    "Similar",
    "Random",
  ]) {
    await expect(legend.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(legend.getByText("Other", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(legend).toHaveCount(0);
  await expect(paletteButton).toBeFocused();
  await paletteButton.click();
  await page.getByRole("heading", { name: "Settings", exact: true }).click();
  await expect(legend).toHaveCount(0);
  expect(
    await settings.evaluate((element) => {
      const controls = element.shadowRoot?.querySelector(".controls-column");
      const feed = element.shadowRoot?.querySelector(".feed-scroll");
      return {
        controls: controls ? getComputedStyle(controls).overflowY : "",
        feed: feed ? getComputedStyle(feed).overflowY : "",
      };
    }),
  ).toEqual({ controls: "auto", feed: "auto" });
});

test("desktop preview paginates the complete generated slate", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Preview", exact: true }).click();

  const settings = page.locator("settings-page");
  await expect(settings.getByText("45 available of 48 ranked", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(settings.locator("settings-feed-preview .card")).toHaveCount(20);
  const nextPage = settings.getByRole("button", { name: "Next preview page" });
  await nextPage.scrollIntoViewIfNeeded();
  await nextPage.click();
  await expect(settings.getByText("Page 2 of 3", { exact: true })).toBeVisible();
  await nextPage.click();
  await expect(settings.getByText("Page 3 of 3", { exact: true })).toBeVisible();
  await expect(settings.locator("settings-feed-preview .card")).toHaveCount(5);
});

test("saving an accepted preview promotes it to a neutral current baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Preview", exact: true }).click();

  const settings = page.locator("settings-page");
  const actions = settings.locator(".preview-actions");
  await expect(actions).toBeVisible({ timeout: 5000 });
  await actions.getByRole("button", { name: "Save Changes" }).click();

  await expect(settings.getByText("Current feed", { exact: true })).toBeVisible();
  await expect(actions).toHaveCount(0);
  await expect(settings.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  await expect(settings.locator("settings-feed-preview .movement")).toHaveCount(20);
  await expect(
    settings.locator('settings-feed-preview .movement wa-icon[name="minus"]'),
  ).toHaveCount(20);
  await expect(
    settings.locator(
      "settings-feed-preview .movement.up, settings-feed-preview .movement.down, settings-feed-preview .movement.new",
    ),
  ).toHaveCount(0);
});

test("mobile keeps preview actions reachable and restores the review dialog on close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSettings(page);
  const settings = page.locator("settings-page");
  await expect(settings.locator(".feed-column")).not.toBeVisible();

  await releaseFreshness(page, "2");
  await expect(page.getByRole("dialog", { name: "Review this change" })).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();

  await expect(settings.locator(".feed-column")).toBeVisible();
  await expect(settings.locator(".preview-header h2")).toHaveText("Time Window");
  await expect(settings.locator(".feed-column")).toHaveCSS("position", "fixed");
  await expect(settings.getByLabel("New post").first()).toBeVisible({ timeout: 5000 });
  await expect(settings.locator('wa-icon[name="seedling"]').first()).toBeVisible();
  const paletteButton = settings.getByRole("button", { name: "Show post color legend" });
  const backButton = settings.getByRole("button", { name: "Back to settings" });
  const paletteBox = await paletteButton.boundingBox();
  const backBox = await backButton.boundingBox();
  expect(paletteBox?.x).toBeLessThan(backBox?.x ?? 0);
  await paletteButton.click();
  await expect(settings.getByRole("region", { name: "Post color legend" })).toBeVisible();
  await paletteButton.click();
  await expect(
    settings.locator(".preview-actions").getByRole("button", { name: "Save Changes" }),
  ).toBeVisible();
  await expect(
    settings.locator(".preview-actions").getByRole("button", { name: "Discard Changes" }),
  ).toBeVisible();
  await expect(settings.locator("settings-feed-preview .movement.up").first()).toHaveCSS(
    "color",
    "rgb(16, 131, 254)",
  );
  await expect(settings.locator("settings-feed-preview .movement.down").first()).toHaveCSS(
    "color",
    "rgb(244, 33, 46)",
  );
  await expect(settings.locator("settings-feed-preview .movement.new").first()).toHaveCSS(
    "color",
    "rgb(0, 186, 124)",
  );
  const imagePill = settings
    .locator("settings-feed-preview .content-pill", {
      hasText: "2 images",
    })
    .first();
  await expect(imagePill).toHaveCSS("color", "rgb(56, 189, 248)");
  await expect(imagePill).toHaveCSS("border-top-color", "rgba(56, 189, 248, 0.8)");
  await expect(settings.getByText("45 available of 48 ranked", { exact: true })).toBeVisible();
  const nextPage = settings.getByRole("button", { name: "Next preview page" });
  await nextPage.scrollIntoViewIfNeeded();
  await expect(settings.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  await nextPage.click();
  await expect(settings.getByText("Page 2 of 3", { exact: true })).toBeVisible();
  await expect(settings.locator("settings-feed-preview .card")).toHaveCount(20);
  await expect(
    settings.locator(".preview-actions").getByRole("button", { name: "Save Changes" }),
  ).toBeVisible();

  await backButton.click();
  await expect(settings.locator(".feed-column")).not.toBeVisible();
  const reviewDialog = page.getByRole("dialog", { name: "Review this change" });
  await expect(reviewDialog).toBeVisible();
  await reviewDialog.getByRole("button", { name: "Discard Changes" }).click();
  await expect(reviewDialog).toHaveCount(0, { timeout: 500 });
});

test("returning the final dirty control to saved restores the current slate automatically", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);

  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator("settings-page .preview-actions")).toBeVisible({ timeout: 5000 });

  await releaseFreshness(page, "5");
  await expect(page.getByRole("dialog", { name: "Review this change" })).toHaveCount(0);
  await expect(
    page.locator("settings-page").getByText("Current feed", { exact: true }),
  ).toBeVisible({
    timeout: 5000,
  });
  await expect(page.locator("settings-page .preview-actions")).toHaveCount(0);
  const movements = page.locator("settings-page settings-feed-preview .movement");
  await expect(movements).toHaveCount(6);
  await expect(
    page.locator('settings-page settings-feed-preview .movement wa-icon[name="minus"]'),
  ).toHaveCount(6);
  await expect(
    page.locator(
      "settings-page settings-feed-preview .movement.up, settings-page settings-feed-preview .movement.down, settings-page settings-feed-preview .movement.new",
    ),
  ).toHaveCount(0);
});

test("Reset Defaults settles only when defaults are the saved baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  const settings = page.locator("settings-page");
  const reset = page.getByRole("button", { name: "Reset settings to defaults" });

  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(settings.locator(".preview-actions")).toBeVisible({ timeout: 5000 });
  await reset.click();
  await expect(settings.getByText("Current feed", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(
    settings.locator('settings-feed-preview .movement wa-icon[name="minus"]'),
  ).toHaveCount(6);

  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(page.getByRole("dialog", { name: "Review this change" })).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(settings.locator(".preview-actions")).toBeVisible({ timeout: 5000 });
  await expect(
    settings.locator(
      "settings-feed-preview .movement.up, settings-feed-preview .movement.down, settings-feed-preview .movement.new",
    ),
  ).not.toHaveCount(0);
});

test("small-screen review actions remain clear and reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openSettings(page);
  await releaseFreshness(page, "2");

  const dialog = page.getByRole("dialog", { name: "Review this change" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.x).toBeGreaterThan(0);
  expect(dialogBox?.width).toBeLessThan(320);
  expect(Math.abs((dialogBox?.x ?? 0) - (320 - (dialogBox?.width ?? 0)) / 2)).toBeLessThan(2);
  expect(Math.abs((dialogBox?.y ?? 0) - (568 - (dialogBox?.height ?? 0)) / 2)).toBeLessThan(2);
  expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(568);
  for (const label of ["Preview", "Save Changes", "Continue Editing", "Discard Changes"]) {
    const button = dialog.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});

test("draft release can save directly or discard without previewing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  const freshness = page.getByRole("slider", { name: "Time Window" });
  const settings = page.locator("settings-page");

  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Save Changes" }).click();
  const saving = page.getByRole("button", { name: "Saving…" });
  await expect(saving).toBeDisabled();
  await expect(freshness).toHaveValue("2");
  await expect(page.getByRole("dialog", { name: "Review this change" })).toHaveCount(0);
  await expect(settings.locator("settings-feed-preview .card")).toHaveCount(20);
  await expect(
    settings.locator('settings-feed-preview .movement wa-icon[name="minus"]'),
  ).toHaveCount(20);
  await expect(
    settings.locator(
      "settings-feed-preview .movement.up, settings-feed-preview .movement.down, settings-feed-preview .movement.new",
    ),
  ).toHaveCount(0);

  await releaseFreshness(page, "4");
  await page.getByRole("button", { name: "Discard Changes" }).click();
  await expect(freshness).toHaveValue("2");
});

test("a failed direct-save generation retains the draft and can be retried", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await page.evaluate(async () => {
    const modulePath = "/src/main.ts";
    const appModule = (await import(modulePath)) as {
      getRootStore(): {
        services: {
          feedApiService: {
            createFeedPreview: () => Promise<unknown>;
          };
        };
      } | null;
    };
    const service = appModule.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Mock feed service unavailable");
    const original = service.createFeedPreview.bind(service);
    service.createFeedPreview = () => {
      service.createFeedPreview = original;
      return Promise.reject(new Error("preview unavailable"));
    };
  });

  await releaseFreshness(page, "2");
  const dialog = page.getByRole("dialog", { name: "Review this change" });
  await dialog.getByRole("button", { name: "Save Changes" }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("have not been saved");
  await expect(page.getByRole("slider", { name: "Time Window" })).toHaveValue("2");
  await expect(page.locator("settings-page settings-feed-preview .card")).toHaveCount(6);

  await dialog.getByRole("button", { name: "Save Changes" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("settings-page settings-feed-preview .card")).toHaveCount(20);
});

test("leaving dirty Settings offers Save, Discard, or Stay", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Continue Editing" }).click();

  await page.locator('.left-sidebar-desktop a[href="#/feedback/your-feed"]').click();
  const leaveDialog = page.getByRole("dialog", { name: "Save your settings?" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Stay" }).click();
  await expect(page).toHaveURL(/#\/settings\/your-feed$/);

  await page.locator('.left-sidebar-desktop a[href="#/feedback/your-feed"]').click();
  await leaveDialog.getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL(/#\/feedback\/your-feed$/);
});

test("navigation Save waits for slate generation and persistence", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Continue Editing" }).click();

  await page.locator('.left-sidebar-desktop a[href="#/feedback/your-feed"]').click();
  const leaveDialog = page.getByRole("dialog", { name: "Save your settings?" });
  await leaveDialog.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/#\/settings\/your-feed$/);
  await expect(leaveDialog.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(page).toHaveURL(/#\/feedback\/your-feed$/);
});

test("mobile leave confirmation is a centered compact dialog", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSettings(page);
  await releaseFreshness(page, "2");
  await page.getByRole("button", { name: "Continue Editing" }).click();
  await page.locator("settings-page").evaluate((element) => {
    const settings = element as HTMLElement & {
      confirmLeave(): Promise<boolean>;
    };
    void settings.confirmLeave();
  });

  const dialog = page.getByRole("dialog", { name: "Save your settings?" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThan(375);
  expect(Math.abs((box?.x ?? 0) - (375 - (box?.width ?? 0)) / 2)).toBeLessThan(2);
  expect(Math.abs((box?.y ?? 0) - (667 - (box?.height ?? 0)) / 2)).toBeLessThan(2);
  await dialog.getByRole("button", { name: "Stay" }).click();
});
