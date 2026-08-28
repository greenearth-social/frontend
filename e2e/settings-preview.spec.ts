import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page): Promise<void> {
  await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/#\/feed\/your-feed$/);
  await page.evaluate(() => {
    window.location.hash = "/settings/your-feed";
  });
  await expect(page).toHaveURL(/#\/settings\/your-feed$/);
  await expect(page.locator("settings-page settings-feed-preview")).toBeAttached();
}

async function releaseFreshness(page: Page, value: string): Promise<void> {
  await page.getByRole("slider", { name: "Time Window" }).evaluate((input, next) => {
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected a range input");
    input.value = next;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function publishNewServedSlate(page: Page, requestId: string): Promise<void> {
  await page.evaluate(async (nextRequestId) => {
    const modulePath = "/src/main.ts";
    const appModule = (await import(modulePath)) as {
      getRootStore(): {
        services: {
          feedApiService: {
            listFeeds: () => Promise<unknown>;
            getFeedDetail: (requestId: string) => Promise<Record<string, unknown>>;
          };
        };
      } | null;
    };
    const service = appModule.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Mock feed service unavailable");
    const originalGetDetail = service.getFeedDetail.bind(service);
    const generatedAt = new Date(Date.now() + 1_000).toISOString();
    service.listFeeds = () =>
      Promise.resolve({
        feeds: [
          {
            requestId: nextRequestId,
            generatedAt,
            feedName: "your-feed",
            apiReleaseSha: "served-api-sha",
            appliedSocialRadius: 2,
            generatorDiagnostics: [],
          },
        ],
      });
    service.getFeedDetail = async (detailRequestId: string) => {
      const current = await originalGetDetail(detailRequestId);
      const rawItems = current["items"];
      const items = Array.isArray(rawItems)
        ? (rawItems as unknown[])
            .filter(
              (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
            )
            .map((item) => ({ ...item }))
        : [];
      const first = items[1];
      if (first) {
        first["author"] = {
          handle: "served-from-bluesky.test",
          displayName: "Served from Bluesky",
          avatarUrl: null,
        };
      }
      return {
        ...current,
        requestId: nextRequestId,
        generatedAt,
        items: first ? [first, ...items.filter((item) => item !== first)] : items,
      };
    };
  }, requestId);
}

test("desktop keeps posts visible at 1280px with the divider chevron", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);

  const sidebar = page.locator(".left-sidebar-desktop");
  const sidebarToggle = sidebar.getByRole("button", { name: "Collapse navigation" });
  await expect(sidebarToggle).toBeVisible();
  await expect(sidebar.locator('.algo-btn[aria-label="MySky"]')).toBeVisible();
  await expect(sidebarToggle.locator('wa-icon[name="chevron-left"]')).toBeVisible();
  const dividerGeometry = await sidebarToggle.evaluate((element) => {
    const sidebarBox = element.closest("aside")?.getBoundingClientRect();
    const toggleBox = element.getBoundingClientRect();
    return {
      dividerOffset: sidebarBox
        ? Math.abs(toggleBox.left + toggleBox.width / 2 - sidebarBox.right)
        : Number.POSITIVE_INFINITY,
      verticalOffset: sidebarBox
        ? Math.abs(toggleBox.top + toggleBox.height / 2 - (sidebarBox.top + sidebarBox.height / 2))
        : Number.POSITIVE_INFINITY,
      width: toggleBox.width,
      height: toggleBox.height,
      borderRadius: getComputedStyle(element).borderRadius,
    };
  });
  expect(dividerGeometry.dividerOffset).toBeLessThanOrEqual(1);
  expect(dividerGeometry.verticalOffset).toBeLessThanOrEqual(1);
  expect(dividerGeometry).toMatchObject({ width: 28, height: 52, borderRadius: "6px" });

  const settings = page.locator("settings-page");
  await expect(settings.locator(".feed-column")).toBeVisible();
  await expect(settings.getByRole("button", { name: "Update Preview" })).toBeDisabled();
  await expect(settings.locator("settings-feed-preview .card")).toHaveCount(6);
  const previewCard = settings.locator("settings-feed-preview .card").first();
  const candidate = previewCard.locator(".metadata .candidate-pill");
  await expect(candidate).toBeVisible();
  await expect(candidate).toHaveText(/\S+/);
  await expect(candidate.locator("xpath=following-sibling::*[1]")).toHaveClass(/movement/);
  const contentCard = settings
    .locator("settings-feed-preview .card")
    .filter({ has: page.locator(".content-pill") })
    .first();
  const contentPill = contentCard.locator(".snippet + .content-row .content-pill").first();
  await expect(contentPill).toBeVisible();
  const pillGeometry = await contentPill.evaluate((pill) => {
    const style = getComputedStyle(pill);
    const row = pill.parentElement?.getBoundingClientRect();
    const box = pill.getBoundingClientRect();
    return {
      borderTopWidth: style.borderTopWidth,
      borderBottomWidth: style.borderBottomWidth,
      pillHeight: box.height,
      rowHeight: row?.height ?? 0,
    };
  });
  expect(pillGeometry).toMatchObject({ borderTopWidth: "1px", borderBottomWidth: "1px" });
  expect(pillGeometry.rowHeight).toBeGreaterThanOrEqual(pillGeometry.pillHeight);
  await expect(page.getByRole("button", { name: /Save|Discard/ })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /Review|Save your settings/ })).toHaveCount(0);

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

test("1024px is desktop: the populated post pane remains beside settings without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await openSettings(page);

  const settings = page.locator("settings-page");
  await expect(settings.locator(".controls-column")).toBeVisible();
  await expect(settings.locator(".feed-column")).toBeVisible();
  await expect(settings.locator("settings-feed-preview .card")).toHaveCount(6);
  await expect(settings.getByRole("button", { name: "Update Preview" })).toBeVisible();
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test("changes persist immediately, Undo/Redo toggles, and Preview never accepts a slate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await page.evaluate(async () => {
    const modulePath = "/src/main.ts";
    const appModule = (await import(modulePath)) as {
      getRootStore(): {
        services: {
          feedApiService: { acceptFeedPreview: (...args: unknown[]) => Promise<unknown> };
        };
      } | null;
    };
    const service = appModule.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Mock feed service unavailable");
    const browserWindow = window as Window & { acceptPreviewCallCount?: number };
    browserWindow.acceptPreviewCallCount = 0;
    const original = service.acceptFeedPreview.bind(service);
    service.acceptFeedPreview = (...args: unknown[]) => {
      browserWindow.acceptPreviewCallCount = (browserWindow.acceptPreviewCallCount ?? 0) + 1;
      return original(...args);
    };
  });

  const settings = page.locator("settings-page");
  const preview = settings.getByRole("button", { name: "Update Preview" });
  const freshness = page.getByRole("slider", { name: "Time Window" });
  await expect(preview).toBeDisabled();
  await releaseFreshness(page, "2");
  await expect(freshness).toHaveValue("2");
  await expect(preview).toBeEnabled();
  await expect(settings.getByRole("button", { name: "Undo last settings change" })).toBeEnabled();
  await expect(
    settings.getByRole("button", { name: "Undo last settings change" }).getByText("Undo"),
  ).toBeVisible();

  await preview.click();
  await expect(settings.getByText("45 available of 48 ranked", { exact: true })).toBeVisible({
    timeout: 12_000,
  });
  await expect(preview).toBeDisabled({ timeout: 12_000 });

  await settings.getByRole("button", { name: "Undo last settings change" }).click();
  await expect(freshness).toHaveValue("5");
  await expect(settings.getByRole("button", { name: "Redo last settings change" })).toBeEnabled();
  await expect(preview).toBeEnabled();

  await preview.click();
  await expect(settings.locator("settings-feed-preview .feed")).toHaveClass(/fade-out/);
  await expect(settings.locator("settings-feed-preview .feed")).toHaveClass(/idle/, {
    timeout: 12_000,
  });
  await expect(preview).toBeDisabled({ timeout: 12_000 });

  await settings.getByRole("button", { name: "Redo last settings change" }).click();
  await expect(freshness).toHaveValue("2");
  await expect(settings.getByRole("button", { name: "Undo last settings change" })).toBeEnabled();
  await expect(preview).toBeEnabled();
  expect(
    await page.evaluate(
      () => (window as Window & { acceptPreviewCallCount?: number }).acceptPreviewCallCount,
    ),
  ).toBe(0);
});

test("a new edit after Undo replaces Redo and Defaults is one undoable action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  const settings = page.locator("settings-page");
  const freshness = page.getByRole("slider", { name: "Time Window" });

  await releaseFreshness(page, "2");
  await settings.getByRole("button", { name: "Undo last settings change" }).click();
  await expect(freshness).toHaveValue("5");
  await releaseFreshness(page, "4");
  await expect(settings.getByRole("button", { name: "Redo last settings change" })).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "Undo last settings change" })).toBeEnabled();

  await settings.getByRole("button", { name: "Reset settings to defaults" }).click();
  await expect(freshness).toHaveValue("5");
  await settings.getByRole("button", { name: "Undo last settings change" }).click();
  await expect(freshness).toHaveValue("4");
});

test("preview pagination remains available and the baseline refreshes automatically", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  const settings = page.locator("settings-page");

  await releaseFreshness(page, "2");
  await settings.getByRole("button", { name: "Update Preview" }).click();
  await expect(settings.getByText("Page 1 of 3", { exact: true })).toBeVisible({ timeout: 6_000 });
  const nextPage = settings.getByRole("button", { name: "Next preview page" });
  await nextPage.click();
  await expect(settings.getByText("Page 2 of 3", { exact: true })).toBeVisible();

  await publishNewServedSlate(page, "served-after-bluesky-refresh");
  await expect(settings.getByRole("button", { name: "Refresh current feed" })).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });
  await expect(
    settings.getByText("Current feed updated from Bluesky", { exact: true }),
  ).toBeVisible();
  await expect(settings.getByText("Served from Bluesky", { exact: true })).toBeVisible();
});

test("375px uses the compact Preview/Back overlay while keeping the feed mounted", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSettings(page);
  const settings = page.locator("settings-page");
  const feed = settings.locator(".feed-column");
  const preview = settings.getByRole("button", { name: "Preview", exact: true });

  await expect(feed).toBeAttached();
  await expect(feed).not.toBeVisible();
  await expect(settings.getByRole("heading", { name: "MySky Settings" })).toBeVisible();
  await expect(settings.locator(".page-title-full")).toBeHidden();
  await expect(settings.locator(".page-title-short")).toHaveText("Settings");
  await expect(settings.locator(".page-title-short")).toBeVisible();
  const fullTitleGeometry = await settings.locator("h1").evaluate((title) => ({
    clientWidth: title.clientWidth,
    scrollWidth: title.scrollWidth,
  }));
  expect(fullTitleGeometry.scrollWidth).toBeLessThanOrEqual(fullTitleGeometry.clientWidth);
  await expect(preview).toBeDisabled();
  await releaseFreshness(page, "2");
  await expect(preview).toBeEnabled();
  const undoPaths = settings
    .getByRole("button", { name: "Undo last settings change" })
    .locator('wa-icon[name="undo"] path');
  await expect(settings.getByRole("button", { name: "Undo last settings change" })).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await expect(undoPaths).toHaveCount(2);
  await expect(undoPaths.nth(0)).toHaveAttribute("fill", "none");
  await expect(undoPaths.nth(1)).toHaveAttribute("fill", "none");
  await preview.click();

  await expect(feed).toBeVisible();
  const mobileActions = settings.locator(".preview-mobile-primary-actions");
  const back = settings.getByRole("button", { name: "Back to settings" });
  await expect(back).toBeVisible();
  await expect(back.locator('wa-icon[name="chevron-left"]')).toBeVisible();
  await expect(mobileActions.locator("button").first()).toHaveAttribute(
    "aria-label",
    "Back to settings",
  );
  await expect(mobileActions.locator("button")).toHaveCount(1);
  await expect(mobileActions.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(mobileActions.locator(".history-btn, .reset-defaults-btn")).toHaveCount(0);
  await expect(settings.locator("settings-feed-preview .card")).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: /Save|Discard/ })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /Review|Save your settings/ })).toHaveCount(0);
  await back.click();
  await expect(feed).not.toBeVisible();
  await expect(page.getByRole("slider", { name: "Time Window" })).toHaveValue("2");
});

test("320px visually shortens the accessible title and wraps header controls cleanly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openSettings(page);
  const settings = page.locator("settings-page");
  await expect(settings.getByRole("heading", { name: "MySky Settings" })).toBeVisible();
  await expect(settings.locator(".page-title-full")).toBeHidden();
  await expect(settings.locator(".page-title-short")).toHaveText("Settings");
  await expect(settings.locator(".page-title-short")).toBeVisible();
  await expect(settings.locator(".reset-defaults-btn .reset-label").first()).toBeVisible();

  const headerGeometry = await settings.locator(".header-row").evaluate((header) => {
    const title = header.querySelector("h1");
    const actions = header.querySelector(".settings-header-actions");
    const actionButtons = Array.from(actions?.querySelectorAll("button") ?? []).map((button) =>
      button.getBoundingClientRect(),
    );
    return {
      height: header.getBoundingClientRect().height,
      headerCenter: header.getBoundingClientRect().left + header.getBoundingClientRect().width / 2,
      titleBottom: title?.getBoundingClientRect().bottom ?? 0,
      actionsTop: actions?.getBoundingClientRect().top ?? 0,
      actionsCenter:
        (actions?.getBoundingClientRect().left ?? 0) +
        (actions?.getBoundingClientRect().width ?? 0) / 2,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
      titleScrollWidth: title?.scrollWidth ?? 0,
      titleClientWidth: title?.clientWidth ?? 0,
      buttonWidths: actionButtons.map((button) => button.width),
      buttonGaps: actionButtons.slice(1).map((button, index) => {
        const previous = actionButtons[index];
        return previous ? button.left - previous.right : 0;
      }),
    };
  });
  expect(headerGeometry.actionsTop).toBeGreaterThanOrEqual(headerGeometry.titleBottom);
  expect(Math.abs(headerGeometry.actionsCenter - headerGeometry.headerCenter)).toBeLessThan(1);
  expect(headerGeometry.scrollWidth).toBeLessThanOrEqual(headerGeometry.clientWidth);
  expect(headerGeometry.titleScrollWidth).toBeLessThanOrEqual(headerGeometry.titleClientWidth);
  expect(headerGeometry.buttonWidths).toHaveLength(2);
  expect(Math.max(...headerGeometry.buttonWidths) - Math.min(...headerGeometry.buttonWidths)).toBeLessThan(
    1,
  );
  expect(Math.max(...headerGeometry.buttonGaps) - Math.min(...headerGeometry.buttonGaps)).toBeLessThan(
    1,
  );
  expect(headerGeometry.height).toBeGreaterThan(60);
  expect(headerGeometry.height).toBeLessThanOrEqual(128);
});

test("crossing the desktop breakpoint returns a stale mobile preview to Settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSettings(page);
  const settings = page.locator("settings-page");
  const feed = settings.locator(".feed-column");
  await releaseFreshness(page, "2");
  await settings.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(feed).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(feed).toBeVisible();
  await page.setViewportSize({ width: 375, height: 667 });

  await expect(feed).not.toBeVisible();
  await expect(page.getByRole("slider", { name: "Time Window" })).toBeVisible();
});

test("Settings keeps the full title until the mobile header is space constrained", async ({
  page,
}) => {
  for (const width of [375, 479]) {
    await page.setViewportSize({ width, height: 720 });
    await openSettings(page);
    const settings = page.locator("settings-page");
    await expect(settings.getByRole("heading", { name: "MySky Settings" })).toBeVisible();
    await expect(settings.locator(".page-title-full")).toBeHidden();
    await expect(settings.locator(".page-title-short")).toBeVisible();
    const title = await settings.locator("h1").evaluate((element) => {
      const header = element.closest(".header-row");
      const actions = header?.querySelector(".settings-header-actions");
      const defaults = header?.querySelector(".reset-defaults-btn");
      const titleRect = element.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      const defaultsRect = defaults?.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        sameRow:
          actionsRect && defaultsRect
            ? Math.max(titleRect.top, actionsRect.top, defaultsRect.top) <
              Math.min(titleRect.bottom, actionsRect.bottom, defaultsRect.bottom)
            : false,
        headerOverflow: (header?.scrollWidth ?? 0) - (header?.clientWidth ?? 0),
      };
    });
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
    expect(title.sameRow).toBe(true);
    expect(title.headerOverflow).toBeLessThanOrEqual(0);
  }

  for (const width of [480, 768, 1023, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    await openSettings(page);
    const settings = page.locator("settings-page");
    await expect(settings.getByRole("heading", { name: "MySky Settings" })).toBeVisible();
    await expect(settings.locator(".page-title-full")).toBeVisible();
    await expect(settings.locator(".page-title-short")).toBeHidden();
    const header = await settings.locator(".header-row").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      titleClientWidth: element.querySelector("h1")?.clientWidth ?? 0,
      titleScrollWidth: element.querySelector("h1")?.scrollWidth ?? 0,
    }));
    expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
    expect(header.titleScrollWidth).toBeLessThanOrEqual(header.titleClientWidth);
  }
});

test("navigation leaves Settings immediately without an unsaved-change dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await releaseFreshness(page, "2");
  await page.locator('.left-sidebar-desktop a[href="#/feedback/your-feed"]').click();
  await expect(page).toHaveURL(/#\/feedback\/your-feed$/);
  await expect(page.getByRole("dialog", { name: "Save your settings?" })).toHaveCount(0);
});

test("feed switching clears stale preview work and enables Preview after the next edit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await page.evaluate(async () => {
    const modulePath = "/src/main.ts";
    const appModule = (await import(modulePath)) as {
      getRootStore(): {
        services: {
          feedApiService: {
            createFeedPreview: (
              feedName: string,
              patch: Record<string, unknown>,
            ) => Promise<unknown>;
          };
        };
      } | null;
    };
    const service = appModule.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Mock feed service unavailable");
    const original = service.createFeedPreview.bind(service);
    let deferNextSettingsPreview = true;
    service.createFeedPreview = (feedName, patch) => {
      if (deferNextSettingsPreview && Object.keys(patch).length > 0) {
        deferNextSettingsPreview = false;
        return new Promise(() => undefined);
      }
      return original(feedName, patch);
    };
  });

  const settings = page.locator("settings-page");
  await releaseFreshness(page, "2");
  await settings.getByRole("button", { name: "Update Preview" }).click();
  await expect(settings.getByText("Generating preview…", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "/settings/random";
  });
  await expect(page).toHaveURL(/#\/settings\/random$/);
  await expect(settings.getByRole("heading", { name: "Random Settings" })).toBeVisible();
  await expect(settings.getByText("Generating preview…", { exact: true })).toHaveCount(0);
  await releaseFreshness(page, "2");
  const preview = settings.getByRole("button", { name: "Update Preview" });
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(preview).toBeDisabled({ timeout: 6_000 });

  await page.evaluate(() => {
    window.location.hash = "/settings/best-of-friends";
  });
  await expect(settings.getByRole("heading", { name: "Best of Friends Settings" })).toBeVisible();
});
