import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page): Promise<void> {
  await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/#\/feed(?:\/your-feed)?$/);
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

async function setSourcePercentage(page: Page, label: string, value: string): Promise<void> {
  await page
    .getByRole("spinbutton", { name: `${label} percentage`, exact: true })
    .evaluate((input, next) => {
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected a number input");
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
  const updatePreview = settings.getByRole("button", { name: "Generating preview" });
  await expect(updatePreview).toBeDisabled();
  await expect(settings.getByRole("button", { name: "Show post color legend" })).toHaveCount(0);
  const previewHeaderGeometry = await settings.locator(".feed-column").evaluate((column) => {
    const columnBox = column.getBoundingClientRect();
    const buttonBox = column.querySelector("#update-preview")?.getBoundingClientRect();
    return {
      columnCenter: columnBox.left + columnBox.width / 2,
      buttonCenter: buttonBox ? buttonBox.left + buttonBox.width / 2 : Number.NaN,
    };
  });
  expect(
    Math.abs(previewHeaderGeometry.columnCenter - previewHeaderGeometry.buttonCenter),
  ).toBeLessThanOrEqual(1);
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

test("100% Liked by Following reaches Preview and preserves ranked fallback cards", async ({
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
            patchPreferences: (
              feedName: string,
              patch: Record<string, unknown>,
            ) => Promise<Record<string, unknown>>;
            createFeedPreview: (
              feedName: string,
              patch: Record<string, unknown>,
            ) => Promise<{ requestId: string }>;
            getFeedPreview: (requestId: string) => Promise<Record<string, unknown>>;
          };
        };
      } | null;
    };
    const service = appModule.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Mock feed service unavailable");
    const originalPatch = service.patchPreferences.bind(service);
    const originalCreate = service.createFeedPreview.bind(service);
    const originalGet = service.getFeedPreview.bind(service);
    service.patchPreferences = async (feedName, patch) => {
      Reflect.set(window, "__myskySavedPatch", patch);
      return originalPatch(feedName, patch);
    };
    service.createFeedPreview = async (feedName, patch) => {
      Reflect.set(window, "__myskyPreviewPatch", patch);
      return originalCreate(feedName, patch);
    };
    service.getFeedPreview = async (requestId) => {
      const current = await originalGet(requestId);
      const items = Array.isArray(current["items"])
        ? (current["items"] as Array<Record<string, unknown>>).slice(0, 2).map((item) => ({
            ...item,
            isPartial: true,
          }))
        : [];
      return {
        ...current,
        items,
        filteringCounts: {
          storedItemCount: items.length,
          displayedItemCount: items.length,
          publiclyFilteredCount: 0,
          unavailableCount: items.length,
          partialItemCount: items.length,
        },
        generatorDiagnostics: [
          {
            name: "network_likes",
            weight: 1,
            requestedCount: 100,
            returnedCount: items.length,
            contributedCount: items.length,
            status: "success",
            reason: null,
            mode: "primary",
          },
        ],
      };
    };
  });

  await setSourcePercentage(page, "Liked by Following", "100");
  const preview = page.getByRole("button", { name: "Generating preview" });
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(page.locator("settings-page settings-feed-preview .card.partial")).toHaveCount(2, {
    timeout: 12_000,
  });
  await expect(
    page
      .locator("settings-page .feed-column .preview-warning")
      .filter({ hasText: /ranked posts are shown with limited details/ }),
  ).toBeVisible();

  const payloads = await page.evaluate(() => ({
    saved: Reflect.get(window, "__myskySavedPatch") as Record<string, unknown>,
    preview: Reflect.get(window, "__myskyPreviewPatch") as Record<string, unknown>,
  }));
  expect(payloads.saved).toMatchObject({
    sourceWeights: { following: 0, networkLikes: 1, authorsTopics: 0, popular: 0 },
  });
  expect(payloads.preview).toMatchObject({
    sourceWeights: { following: 0, networkLikes: 1, authorsTopics: 0, popular: 0 },
  });
});

test("100% Following reaches persistence and Preview with every other source at zero", async ({
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
            patchPreferences: (
              feedName: string,
              patch: Record<string, unknown>,
            ) => Promise<Record<string, unknown>>;
            createFeedPreview: (
              feedName: string,
              patch: Record<string, unknown>,
            ) => Promise<{ requestId: string }>;
          };
        };
      } | null;
    };
    const service = appModule.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Mock feed service unavailable");
    const originalPatch = service.patchPreferences.bind(service);
    const originalCreate = service.createFeedPreview.bind(service);
    service.patchPreferences = async (feedName, patch) => {
      Reflect.set(window, "__myskyFollowingSavedPatch", patch);
      return originalPatch(feedName, patch);
    };
    service.createFeedPreview = async (feedName, patch) => {
      Reflect.set(window, "__myskyFollowingPreviewPatch", patch);
      return originalCreate(feedName, patch);
    };
  });

  await setSourcePercentage(page, "Following", "100");
  const preview = page.getByRole("button", { name: "Generating preview" });
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect
    .poll(() => page.evaluate(() => Boolean(Reflect.get(window, "__myskyFollowingPreviewPatch"))))
    .toBe(true);

  const payloads = await page.evaluate(() => ({
    saved: Reflect.get(window, "__myskyFollowingSavedPatch") as Record<string, unknown>,
    preview: Reflect.get(window, "__myskyFollowingPreviewPatch") as Record<string, unknown>,
  }));
  const expectedWeights = { following: 1, networkLikes: 0, authorsTopics: 0, popular: 0 };
  expect(payloads.saved).toMatchObject({ sourceWeights: expectedWeights });
  expect(payloads.preview).toMatchObject({ sourceWeights: expectedWeights });
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
  await expect(settings.getByRole("button", { name: "Generating preview" })).toBeVisible();
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test("changes persist immediately and each displayed Preview is accepted exactly once", async ({
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
            acceptFeedPreview: (
              feedName: string,
              requestId: string,
              patch: Record<string, unknown>,
              displayedItemUris: string[],
            ) => Promise<unknown>;
          };
        };
      } | null;
    };
    const service = appModule.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Mock feed service unavailable");
    const browserWindow = window as Window & {
      acceptPreviewCalls?: Array<{
        feedName: string;
        requestId: string;
        patch: Record<string, unknown>;
        displayedItemUris: string[];
      }>;
    };
    browserWindow.acceptPreviewCalls = [];
    const original = service.acceptFeedPreview.bind(service);
    service.acceptFeedPreview = (feedName, requestId, patch, displayedItemUris) => {
      browserWindow.acceptPreviewCalls?.push({
        feedName,
        requestId,
        patch,
        displayedItemUris: [...displayedItemUris],
      });
      return original(feedName, requestId, patch, displayedItemUris);
    };
  });

  const settings = page.locator("settings-page");
  const preview = settings.locator("#update-preview");
  await expect(preview).toHaveText("Generating preview");
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
  await expect(settings.locator("#update-preview")).toHaveText("Generating preview");
  await expect(settings.getByText(/shown of .* ranked/)).toHaveCount(0);
  await expect(preview).toHaveText("Update preview", { timeout: 12_000 });
  await expect(preview).toBeDisabled();
  await expect(settings.locator(".mobile-preview-status")).toHaveCount(0);
  await expect(settings.locator("settings-feed-preview .feed")).toHaveClass(/idle/, {
    timeout: 12_000,
  });

  await settings.getByRole("button", { name: "Undo last settings change" }).click();
  await expect(freshness).toHaveValue("5");
  await expect(settings.getByRole("button", { name: "Redo last settings change" })).toBeEnabled();
  await expect(preview).toBeEnabled();

  await preview.click();
  await expect(settings.locator("settings-feed-preview .feed")).toHaveClass(/fade-out/);
  await expect(settings.locator("settings-feed-preview .feed")).toHaveClass(/idle/, {
    timeout: 12_000,
  });
  await expect(preview).toHaveText("Update preview", { timeout: 12_000 });
  await expect(preview).toBeDisabled();

  await settings.getByRole("button", { name: "Redo last settings change" }).click();
  await expect(freshness).toHaveValue("2");
  await expect(settings.getByRole("button", { name: "Undo last settings change" })).toBeEnabled();
  await expect(preview).toBeEnabled();
  const acceptanceCalls = await page.evaluate(
    () =>
      (
        window as Window & {
          acceptPreviewCalls?: Array<{
            feedName: string;
            requestId: string;
            patch: Record<string, unknown>;
            displayedItemUris: string[];
          }>;
        }
      ).acceptPreviewCalls ?? [],
  );
  expect(acceptanceCalls).toHaveLength(2);
  expect(acceptanceCalls[0]).toMatchObject({
    feedName: "your-feed",
    patch: { freshness: 2 },
  });
  expect(acceptanceCalls[1]).toMatchObject({
    feedName: "your-feed",
    patch: { freshness: 5 },
  });
  for (const call of acceptanceCalls) {
    expect(call.requestId).toMatch(/^preview-/);
    expect(call.displayedItemUris.length).toBeGreaterThan(0);
    expect(new Set(call.displayedItemUris).size).toBe(call.displayedItemUris.length);
  }
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
  await settings.getByRole("button", { name: "Generating preview" }).click();
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
  const actionOrder = await settings.locator(".header-row").evaluate((header) => {
    const titleBox = header.querySelector("h1")?.getBoundingClientRect();
    const previewBox = header.querySelector(".mobile-preview-btn")?.getBoundingClientRect();
    const undoBox = header.querySelector(".history-btn")?.getBoundingClientRect();
    const defaultsBox = header.querySelector(".reset-defaults-btn")?.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    return {
      titleCenter: titleBox ? titleBox.top + titleBox.height / 2 : 0,
      previewCenter: previewBox ? previewBox.left + previewBox.width / 2 : 0,
      undoCenter: undoBox ? undoBox.top + undoBox.height / 2 : 0,
      defaultsCenter: defaultsBox ? defaultsBox.top + defaultsBox.height / 2 : 0,
      headerCenter: headerBox.left + headerBox.width / 2,
      topRowBottom: Math.max(titleBox?.bottom ?? 0, undoBox?.bottom ?? 0, defaultsBox?.bottom ?? 0),
      previewTop: previewBox?.top ?? 0,
      previewWidth: previewBox?.width ?? 0,
      widestTopAction: Math.max(undoBox?.width ?? 0, defaultsBox?.width ?? 0),
      undoLeft: undoBox?.left ?? 0,
      defaultsLeft: defaultsBox?.left ?? 0,
    };
  });
  expect(
    Math.max(actionOrder.titleCenter, actionOrder.undoCenter, actionOrder.defaultsCenter) -
      Math.min(actionOrder.titleCenter, actionOrder.undoCenter, actionOrder.defaultsCenter),
  ).toBeLessThan(1);
  expect(actionOrder.previewTop).toBeGreaterThanOrEqual(actionOrder.topRowBottom);
  expect(actionOrder.previewWidth).toBeGreaterThan(actionOrder.widestTopAction * 2);
  expect(Math.abs(actionOrder.previewCenter - actionOrder.headerCenter)).toBeLessThan(1);
  expect(actionOrder.undoLeft).toBeLessThan(actionOrder.defaultsLeft);
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
  await expect(settings.locator("settings-feed-preview .feed")).toHaveClass(/idle/);
  const mobileActions = settings.locator(".preview-mobile-primary-actions");
  const back = settings.getByRole("button", { name: "Back to settings" });
  await expect(back).toBeVisible();
  await expect(back.locator('wa-icon[name="chevron-left"]')).toBeVisible();
  await expect(mobileActions.locator("button").first()).toHaveAttribute(
    "aria-label",
    "Back to settings",
  );
  await expect(mobileActions.locator("button")).toHaveCount(1);
  await expect(mobileActions.getByRole("heading", { name: "Settings" })).toHaveCount(0);
  await expect(mobileActions.locator(".mobile-preview-status")).toHaveCount(0);
  await expect(mobileActions.locator(".history-btn, .reset-defaults-btn")).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "Show post color legend" })).toHaveCount(0);
  await expect(settings.locator("settings-feed-preview .card")).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: /Save|Discard/ })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /Review|Save your settings/ })).toHaveCount(0);
  await back.click();
  await expect(feed).not.toBeVisible();
  await expect(page.getByRole("slider", { name: "Time Window" })).toHaveValue("2");
});

test("mobile opens Preview on the first tap and keeps generation status in the Settings header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
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
    service.createFeedPreview = () => new Promise(() => undefined);
  });

  const settings = page.locator("settings-page");
  await releaseFreshness(page, "2");
  await settings.getByRole("button", { name: "Preview", exact: true }).click();

  await expect(settings.locator(".feed-column")).toBeVisible();
  await expect(settings.locator(".mobile-preview-title")).toHaveCount(0);
  await expect(settings.locator(".mobile-preview-status")).toHaveText("Generating Preview");
  await expect(settings.locator(".preview-generating")).toHaveCount(0);
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
    const preview = header.querySelector(".mobile-preview-btn")?.getBoundingClientRect();
    const undo = header.querySelector(".history-btn")?.getBoundingClientRect();
    const defaults = header.querySelector(".reset-defaults-btn")?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    return {
      height: header.getBoundingClientRect().height,
      topRowBottom: Math.max(titleRect?.bottom ?? 0, undo?.bottom ?? 0, defaults?.bottom ?? 0),
      previewTop: preview?.top ?? 0,
      previewWidth: preview?.width ?? 0,
      widestTopAction: Math.max(undo?.width ?? 0, defaults?.width ?? 0),
      previewCenter: preview ? preview.left + preview.width / 2 : 0,
      headerCenter: header.getBoundingClientRect().left + header.getBoundingClientRect().width / 2,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
      titleScrollWidth: title?.scrollWidth ?? 0,
      titleClientWidth: title?.clientWidth ?? 0,
      titleOverflow: title ? getComputedStyle(title).textOverflow : "",
      titleCenter: titleRect ? titleRect.top + titleRect.height / 2 : 0,
      undoCenter: undo ? undo.top + undo.height / 2 : 0,
      defaultsCenter: defaults ? defaults.top + defaults.height / 2 : 0,
    };
  });
  expect(headerGeometry.previewTop).toBeGreaterThanOrEqual(headerGeometry.topRowBottom);
  expect(headerGeometry.previewWidth).toBeGreaterThan(headerGeometry.widestTopAction * 2);
  expect(Math.abs(headerGeometry.previewCenter - headerGeometry.headerCenter)).toBeLessThan(1);
  expect(
    Math.max(headerGeometry.titleCenter, headerGeometry.undoCenter, headerGeometry.defaultsCenter) -
      Math.min(
        headerGeometry.titleCenter,
        headerGeometry.undoCenter,
        headerGeometry.defaultsCenter,
      ),
  ).toBeLessThan(1);
  expect(headerGeometry.scrollWidth).toBeLessThanOrEqual(headerGeometry.clientWidth);
  expect(headerGeometry.titleScrollWidth).toBeLessThanOrEqual(headerGeometry.titleClientWidth);
  expect(headerGeometry.titleOverflow).not.toBe("ellipsis");
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

test("Settings centers wrapped Preview and never ellipsizes its title", async ({ page }) => {
  for (const width of [240, 280, 300, 320, 374, 375, 430, 479]) {
    await page.setViewportSize({ width, height: 720 });
    await openSettings(page);
    const settings = page.locator("settings-page");
    await expect(settings.getByRole("heading", { name: "MySky Settings" })).toBeVisible();
    await expect(settings.locator(".page-title-full")).toBeHidden();
    await expect(settings.locator(".page-title-short")).toBeVisible();
    const geometry = await settings.locator("h1").evaluate((element) => {
      const header = element.closest(".header-row");
      const undo = header?.querySelector(".history-btn");
      const defaults = header?.querySelector(".reset-defaults-btn");
      const preview = header?.querySelector(".mobile-preview-btn");
      const titleRect = element.getBoundingClientRect();
      const undoRect = undo?.getBoundingClientRect();
      const defaultsRect = defaults?.getBoundingClientRect();
      const previewRect = preview?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      const center = (rect: DOMRect | undefined) => (rect ? rect.top + rect.height / 2 : 0);
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        titleOverflow: getComputedStyle(element).textOverflow,
        topRowCenters: [center(titleRect), center(undoRect), center(defaultsRect)],
        topRowBottom: Math.max(titleRect.bottom, undoRect?.bottom ?? 0, defaultsRect?.bottom ?? 0),
        previewTop: previewRect?.top ?? 0,
        previewWidth: previewRect?.width ?? 0,
        widestTopAction: Math.max(undoRect?.width ?? 0, defaultsRect?.width ?? 0),
        previewCenter: previewRect ? previewRect.left + previewRect.width / 2 : 0,
        headerCenter: headerRect ? headerRect.left + headerRect.width / 2 : 0,
        headerOverflow: (header?.scrollWidth ?? 0) - (header?.clientWidth ?? 0),
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.titleOverflow).not.toBe("ellipsis");
    expect(Math.max(...geometry.topRowCenters) - Math.min(...geometry.topRowCenters)).toBeLessThan(
      1,
    );
    expect(geometry.previewTop).toBeGreaterThanOrEqual(geometry.topRowBottom);
    expect(geometry.previewWidth).toBeGreaterThan(geometry.widestTopAction * 2);
    expect(Math.abs(geometry.previewCenter - geometry.headerCenter)).toBeLessThan(1);
    expect(geometry.headerOverflow).toBeLessThanOrEqual(0);
  }

  for (const width of [480, 600, 767]) {
    await page.setViewportSize({ width, height: 720 });
    await openSettings(page);
    const settings = page.locator("settings-page");
    await expect(settings.getByRole("heading", { name: "MySky Settings" })).toBeVisible();
    await expect(settings.locator(".page-title-full")).toBeHidden();
    await expect(settings.locator(".page-title-short")).toBeVisible();
    const geometry = await settings.locator("h1").evaluate((element) => {
      const header = element.closest(".header-row");
      const rects = [
        element,
        header?.querySelector(".mobile-preview-btn"),
        header?.querySelector(".history-btn"),
        header?.querySelector(".reset-defaults-btn"),
      ].map((node) => node?.getBoundingClientRect());
      const centers = rects.map((rect) => (rect ? rect.top + rect.height / 2 : 0));
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        titleOverflow: getComputedStyle(element).textOverflow,
        centers,
        headerOverflow: (header?.scrollWidth ?? 0) - (header?.clientWidth ?? 0),
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.titleOverflow).not.toBe("ellipsis");
    expect(Math.max(...geometry.centers) - Math.min(...geometry.centers)).toBeLessThan(1);
    expect(geometry.headerOverflow).toBeLessThanOrEqual(0);
  }

  for (const width of [768, 1023, 1024, 1280]) {
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

test("all feed settings headers keep every action visible without overlap", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openSettings(page);
  const settings = page.locator("settings-page");
  const feeds = ["your-feed", "best-of-friends", "random"];
  const widths = [240, 280, 300, 320, 374, 375, 430, 479, 480, 600, 767, 768, 1023, 1024, 1280];
  const failures: Array<{ feed: string; width: number; issues: string[] }> = [];

  for (const feed of feeds) {
    await page.evaluate((nextFeed) => {
      window.location.hash = `/settings/${nextFeed}`;
    }, feed);
    await expect(page).toHaveURL(new RegExp(`#\\/settings\\/${feed}$`));

    for (const width of widths) {
      await page.setViewportSize({ width, height: 720 });
      const issues = await settings.locator(".header-row").evaluate((header) => {
        const viewportWidth = document.documentElement.clientWidth;
        const visibleElements = Array.from(
          header.querySelectorAll<HTMLElement>(
            ".hamburger-btn, h1, .mobile-preview-btn, .history-btn, .reset-defaults-btn",
          ),
        ).filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
        });
        const found: string[] = [];

        if (header.scrollWidth > header.clientWidth) found.push("header overflow");
        for (const element of visibleElements) {
          const rect = element.getBoundingClientRect();
          const name = element.className || element.tagName.toLowerCase();
          if (rect.left < -0.5 || rect.right > viewportWidth + 0.5) found.push(`${name} clipped`);
        }

        for (let first = 0; first < visibleElements.length; first += 1) {
          for (let second = first + 1; second < visibleElements.length; second += 1) {
            const firstElement = visibleElements[first];
            const secondElement = visibleElements[second];
            if (!firstElement || !secondElement) continue;
            const a = firstElement.getBoundingClientRect();
            const b = secondElement.getBoundingClientRect();
            const overlaps =
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
            if (overlaps)
              found.push(`${firstElement.className} overlaps ${secondElement.className}`);
          }
        }

        const visibleTitle = Array.from(
          header.querySelectorAll<HTMLElement>(".page-title-full, .page-title-short"),
        ).find((title) => getComputedStyle(title).display !== "none");
        if (visibleTitle && visibleTitle.scrollWidth > visibleTitle.clientWidth) {
          found.push("title clipped");
        }
        const resetLabel = header.querySelector<HTMLElement>(".reset-label");
        if (resetLabel && resetLabel.scrollWidth > resetLabel.clientWidth) {
          found.push("Defaults clipped");
        }
        return found;
      });
      if (issues.length > 0) failures.push({ feed, width, issues });
    }
  }

  expect(failures).toEqual([]);
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
  await settings.getByRole("button", { name: "Generating preview" }).click();
  await expect(settings.locator("#update-preview")).toHaveText("Generating preview");

  await page.evaluate(() => {
    window.location.hash = "/settings/random";
  });
  await expect(page).toHaveURL(/#\/settings\/random$/);
  await expect(settings.getByRole("heading", { name: "Random Settings" })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Generating preview" })).toBeDisabled();
  await releaseFreshness(page, "2");
  const preview = settings.locator("#update-preview");
  await expect(preview).toHaveText("Generating preview");
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(preview).toHaveText("Update preview", { timeout: 6_000 });
  await expect(preview).toBeDisabled();

  await page.evaluate(() => {
    window.location.hash = "/settings/best-of-friends";
  });
  await expect(settings.getByRole("heading", { name: "Best of Friends Settings" })).toBeVisible();
});

test("feed switching cancels an active preview animation and settles the new baseline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const browserWindow = window as Window & {
      settingsPreviewAnimationStarted?: boolean;
      settingsPreviewAnimationCancelCount?: number;
    };
    const originalAnimate = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function (...args: Parameters<HTMLElement["animate"]>) {
      const animation = originalAnimate.apply(this, args);
      if (this.tagName.toLowerCase() !== "settings-feed-preview") return animation;
      browserWindow.settingsPreviewAnimationStarted = true;
      browserWindow.settingsPreviewAnimationCancelCount = 0;
      animation.pause();
      const originalCancel = animation.cancel.bind(animation);
      animation.cancel = () => {
        browserWindow.settingsPreviewAnimationCancelCount =
          (browserWindow.settingsPreviewAnimationCancelCount ?? 0) + 1;
        originalCancel();
      };
      return animation;
    };
  });

  const settings = page.locator("settings-page");
  await releaseFreshness(page, "2");
  await settings.locator("#update-preview").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as Window & { settingsPreviewAnimationStarted?: boolean })
            .settingsPreviewAnimationStarted,
        ),
      ),
    )
    .toBe(true);

  await page.evaluate(() => {
    window.location.hash = "/settings/random";
  });
  await expect(page).toHaveURL(/#\/settings\/random$/);
  await expect(settings.getByRole("heading", { name: "Random Settings" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { settingsPreviewAnimationCancelCount?: number })
            .settingsPreviewAnimationCancelCount ?? 0,
      ),
    )
    .toBe(1);
  await expect(settings.locator("settings-feed-preview .card").first()).toBeVisible();

  const renderedUris = await settings
    .locator("settings-feed-preview .card")
    .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.uri));
  const activeBaselineUris = await page.evaluate(async () => {
    const modulePath = "/src/main.ts";
    const appModule = (await import(modulePath)) as {
      getRootStore(): {
        settingsPreviewStore: { displayedItems: Array<{ atUri: string }> };
      } | null;
    };
    return (
      appModule.getRootStore()?.settingsPreviewStore.displayedItems.map((item) => item.atUri) ?? []
    );
  });
  expect(renderedUris).toEqual(activeBaselineUris.slice(0, renderedUris.length));
});
