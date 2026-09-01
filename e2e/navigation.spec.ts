import { expect, test } from "@playwright/test";
import { ALGORITHMS } from "../src/constants/algorithms";

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
    await expect(desktop.locator('.nav-link[aria-current="page"]')).toHaveAttribute(
      "href",
      "#/settings/best-of-friends",
    );
    await expect(desktop.locator('.algo-btn[aria-label="Best of Friends"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

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

  test("shows each Bluesky View Feed link before its internal pages", async ({ page }) => {
    const desktop = page.locator(".left-sidebar-desktop");

    for (const id of ["your-feed", "best-of-friends", "random"] as const) {
      const subnav = desktop.locator(`#desktop-${id}-pages`);
      const viewFeed = subnav.locator(":scope > .view-feed-link");
      await expect(viewFeed).toHaveAttribute("href", ALGORITHMS[id].blueskyUrl);
      await expect(viewFeed).toHaveAttribute("target", "_blank");
      await expect(viewFeed.locator('wa-icon[name="bluesky"]')).toHaveCount(1);
      await expect(viewFeed.locator('wa-icon[name="external-link"]')).toHaveCount(1);
      await expect(subnav.locator(":scope > a").first()).toHaveClass(/view-feed-link/);
      await expect(subnav.locator(":scope > a").nth(1)).toContainText("Why Am I Seeing This?");
    }

    await page.context().route("https://bsky.app/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "Bluesky feed" });
    });
    const popupPromise = page.waitForEvent("popup");
    await desktop.locator("#desktop-your-feed-pages .view-feed-link").click();
    const blueskyFeed = await popupPromise;
    await expect.poll(() => blueskyFeed.url()).toBe(ALGORITHMS["your-feed"].blueskyUrl);
    await blueskyFeed.close();
  });

  test("selected feed titles collapse their pages on desktop and mobile", async ({ page }) => {
    const desktop = page.locator(".left-sidebar-desktop");
    const desktopPages = desktop.locator("#desktop-your-feed-pages");
    await expect(desktopPages).toBeVisible();

    await desktop.locator('.algo-btn[aria-label="MySky"]').click();
    await expect(desktopPages).toBeHidden();
    await expect(page).toHaveURL(/#\/feed\/your-feed$/);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator("feed-page").getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.locator(".drawer.open");
    await expect(drawer).toBeVisible();

    await drawer.getByRole("button", { name: "Expand MySky pages" }).click();
    const drawerPages = drawer.locator("#drawer-your-feed-pages");
    await expect(drawerPages).toBeVisible();
    await drawer.locator('.algo-btn[aria-label="MySky"]').click();
    await expect(drawerPages).toBeHidden();
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/#\/feed\/your-feed$/);

    await drawer.locator('.algo-btn[aria-label="Best of Friends"]').click();
    await expect(page).toHaveURL(/#\/feed\/best-of-friends$/);
    await expect(drawer.locator("#drawer-best-of-friends-pages")).toBeVisible();
  });

  test("anchors the collapsible desktop navigation across every page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 520 });
    const desktop = page.locator(".left-sidebar-desktop");
    const initialBox = await desktop.boundingBox();
    expect(initialBox?.width).toBe(275);

    await desktop.locator('a[href="#/settings/your-feed"]').click();
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);
    expect((await desktop.boundingBox())?.x).toBe(initialBox?.x);

    await desktop.locator('a[href="#/feedback/your-feed"]').click();
    await expect(page).toHaveURL(/#\/feedback\/your-feed$/);
    expect((await desktop.boundingBox())?.x).toBe(initialBox?.x);

    await desktop.getByRole("button", { name: "Collapse navigation" }).click();
    await expect(desktop).toHaveCSS("width", "72px");
    await desktop.locator('a[href="#/feed/your-feed"]').click();
    await expect(page).toHaveURL(/#\/feed\/your-feed$/);
    await expect(desktop.getByRole("button", { name: "Expand navigation" })).toBeVisible();

    await desktop.getByRole("button", { name: "More options" }).click();
    const logout = desktop.getByRole("button", { name: "Log out" });
    await expect(logout.locator('wa-icon[name="lock"]')).toBeVisible();
    await expect(desktop.locator(".logout-menu.compact")).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(logout).toHaveCSS("color", "rgb(244, 33, 46)");
    await expect
      .poll(() =>
        logout.locator('wa-icon[name="lock"]').evaluate((icon) => {
          const lockBody = icon.shadowRoot?.querySelector("svg rect");
          return lockBody ? getComputedStyle(lockBody).fill : null;
        }),
      )
      .toBe("none");
    const logoutBox = await logout.boundingBox();
    expect(logoutBox).not.toBeNull();
    expect((logoutBox?.y ?? -1) + (logoutBox?.height ?? 0)).toBeLessThanOrEqual(520);
  });

  test("active feed icon toggles its pages in the collapsed desktop rail", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 720 });
    const feedLabel = ALGORITHMS["your-feed"].label;
    const desktop = page.locator(".left-sidebar-desktop");
    await desktop.getByRole("button", { name: "Collapse navigation" }).click();

    const pages = desktop.locator("#desktop-your-feed-pages");
    const collapseFeed = desktop.getByRole("button", {
      name: `Collapse ${feedLabel} pages`,
    });
    await expect(collapseFeed).toHaveAttribute("aria-expanded", "true");
    await collapseFeed.click();
    await expect(pages).toBeHidden();
    await expect(page).toHaveURL(/#\/feed\/your-feed$/);

    const expandFeed = desktop.getByRole("button", { name: `Expand ${feedLabel} pages` });
    await expandFeed.click();
    await expect(pages).toBeVisible();
    await expect(
      desktop.getByRole("button", { name: `Collapse ${feedLabel} pages` }),
    ).toHaveAttribute("aria-expanded", "true");
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

  test("visually separates expanded feed groups from their subpages", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    const desktop = page.locator(".left-sidebar-desktop");

    for (const feed of ["Best of Friends", "Random"]) {
      await desktop.getByRole("button", { name: `Expand ${feed} pages` }).click();
    }

    const groups = desktop.locator(".feed-group");
    await expect(groups).toHaveCount(3);
    await expect(desktop.locator(".feed-subnav:not([hidden])")).toHaveCount(3);

    const groupStyles = await groups.evaluateAll((elements) =>
      elements.map((element) => ({
        borderStyle: getComputedStyle(element).borderStyle,
        borderRadius: getComputedStyle(element).borderRadius,
      })),
    );
    expect(groupStyles).toEqual(
      Array.from({ length: 3 }, () => ({
        borderStyle: "solid",
        borderRadius: "14px",
      })),
    );

    const activeGroup = desktop.locator(".feed-group.active-feed");
    await expect(activeGroup).toHaveCount(1);
    await expect(activeGroup.locator('.algo-btn[aria-pressed="true"]')).toHaveCount(1);

    const bestOfFriends = desktop.locator('.algo-btn[aria-label="Best of Friends"]');
    const bestOfFriendsGeometry = await bestOfFriends.evaluate((button) => {
      const icon = button.querySelector("wa-icon")?.getBoundingClientRect();
      const label = button.querySelector<HTMLElement>(".algo-label");
      const labelRect = label?.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return {
        iconInset: icon ? icon.left - buttonRect.left : 0,
        iconToLabelGap: icon && labelRect ? labelRect.left - icon.right : 0,
        labelClientWidth: label?.clientWidth ?? 0,
        labelScrollWidth: label?.scrollWidth ?? 0,
      };
    });
    expect(bestOfFriendsGeometry.iconInset).toBeLessThanOrEqual(7);
    expect(bestOfFriendsGeometry.iconToLabelGap).toBeLessThanOrEqual(7);
    expect(bestOfFriendsGeometry.labelScrollWidth).toBeLessThanOrEqual(
      bestOfFriendsGeometry.labelClientWidth,
    );
  });

  test("places Politics in Ranking without the combined source-rank control", async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = "/settings/your-feed";
    });
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);
    const settings = page.locator("settings-page");
    const ranking = settings.locator(".section-ranking");
    await expect(settings.getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(settings.getByRole("button", { name: "Learn more about Sources" })).toHaveCount(0);
    const politics = ranking.locator(".ranking-grid > .politics-card");
    await expect(politics).toBeVisible();
    expect(
      await politics.evaluate((element) => ({
        start: getComputedStyle(element).gridColumnStart,
        end: getComputedStyle(element).gridColumnEnd,
      })),
    ).toEqual({ start: "1", end: "-1" });

    await expect(page.getByRole("slider", { name: "Source rank" })).toHaveCount(0);
    await expect(page.getByText("Friends", { exact: true })).toHaveCount(0);
    await expect(page.getByText("All", { exact: true })).toHaveCount(0);

    await page.evaluate(() => {
      window.location.hash = "/settings/random";
    });
    await expect(page).toHaveURL(/#\/settings\/random$/);
    await expect(settings.locator(".politics-card")).toHaveCount(0);
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
    await expect(page.getByRole("slider", { name: "Source rank" })).toHaveCount(0);
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
    await expect(
      page.getByRole("slider", {
        name: "Liked by Following amount",
        exact: true,
      }),
    ).toHaveValue("0.2");
    await expect(page.getByRole("dialog", { name: "Review this change" })).toHaveCount(0);
    await expect(reset).toBeDisabled();
  });

  test("keeps the four-source Settings rail usable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.evaluate(() => {
      window.location.hash = "/settings/your-feed";
    });
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);

    const settings = page.locator("settings-page");
    await expect(page.getByRole("slider", { name: "Source rank" })).toHaveCount(0);

    const timeWindowTitleBox = await settings
      .getByRole("button", { name: "Learn more about Time Window" })
      .boundingBox();
    expect(timeWindowTitleBox).not.toBeNull();
    for (const label of ["Following", "Liked by Following", "Liked Authors/Topics", "Popular"]) {
      const sourceTitleBox = await settings
        .getByRole("button", { name: `Learn more about ${label}`, exact: true })
        .boundingBox();
      expect(sourceTitleBox).not.toBeNull();
      if (timeWindowTitleBox && sourceTitleBox) {
        expect(
          Math.abs(
            sourceTitleBox.x +
              sourceTitleBox.width / 2 -
              (timeWindowTitleBox.x + timeWindowTitleBox.width / 2),
          ),
        ).toBeLessThanOrEqual(1);
      }
    }

    const firstSourceCard = settings.locator(".source-slider-card").first();
    const cardBox = await firstSourceCard.boundingBox();
    const sliderBox = await firstSourceCard.locator("icon-range-slider").boundingBox();
    const trackBox = await firstSourceCard.locator(".range-shell").boundingBox();
    const lockBox = await firstSourceCard.locator(".source-lock-btn").boundingBox();
    expect(cardBox).not.toBeNull();
    expect(sliderBox).not.toBeNull();
    expect(trackBox).not.toBeNull();
    expect(lockBox).not.toBeNull();
    expect(lockBox).toMatchObject({ width: 38, height: 38 });
    expect((trackBox?.width ?? 0) / (sliderBox?.width ?? 1)).toBeGreaterThan(0.75);
    if (cardBox && sliderBox && trackBox && lockBox) {
      const narrowThumbRadius = 16;
      expect(trackBox.x - narrowThumbRadius).toBeGreaterThanOrEqual(sliderBox.x);
      expect(trackBox.x + trackBox.width + narrowThumbRadius).toBeLessThanOrEqual(
        sliderBox.x + sliderBox.width,
      );
      expect(
        Math.abs(lockBox.y + lockBox.height / 2 - (cardBox.y + cardBox.height / 2)),
      ).toBeLessThan(1);
      const sliderToLockGap = lockBox.x - (trackBox.x + trackBox.width);
      const lockToRightBorder = cardBox.x + cardBox.width - (lockBox.x + lockBox.width);
      expect(Math.abs(sliderToLockGap - lockToRightBorder)).toBeLessThanOrEqual(2);
    }

    const lockBoxes = await settings.locator(".source-lock-btn").evaluateAll((locks) =>
      locks.map((lock) => {
        const box = lock.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      }),
    );
    for (let index = 1; index < lockBoxes.length; index += 1) {
      const current = lockBoxes[index];
      const previous = lockBoxes[index - 1];
      if (!current || !previous) throw new Error("Expected adjacent source lock buttons");
      expect(current.top - previous.bottom).toBeGreaterThanOrEqual(16);
    }

    const following = page.getByRole("slider", {
      name: "Following amount",
      exact: true,
    });
    const followingCard = settings.locator(".source-slider-card").filter({ has: following });
    await expect(followingCard.locator(".value")).toHaveText("30%");
    const networkLock = page.getByRole("button", {
      name: "Lock Liked by Following weight",
    });
    await expect(
      networkLock.locator("xpath=ancestor::*[contains(@class, 'source-slider-card')]"),
    ).toHaveCount(1);
    await networkLock.click();
    await expect(
      page.getByRole("button", {
        name: "Unlock Liked by Following weight",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", {
        name: "Unlock Liked by Following weight",
      }),
    ).toHaveCSS("background-color", "rgb(145, 189, 63)");
    await expect(following).toHaveAttribute("aria-valuemax", "0.8");
    await following.evaluate((input) => {
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected a range input");
      input.value = "0.4";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(followingCard.locator(".value")).toHaveText("40%");
    const networkCard = settings.locator(".source-slider-card").filter({
      has: page.getByRole("slider", { name: "Liked by Following amount", exact: true }),
    });
    await expect(networkCard.locator(".value")).toHaveText("20%");

    await page
      .getByRole("button", {
        name: "Lock Liked Authors/Topics weight",
      })
      .click();
    await page.getByRole("button", { name: "Lock Popular weight" }).click();
    await expect(following).toBeDisabled();
    await expect(followingCard.locator(".value")).toHaveText("40%");
    await expect(
      page.getByRole("button", {
        name: "Lock Following weight",
      }),
    ).toBeDisabled();
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    await expect(settings.locator(".source-controls-help, .percentage-suffix")).toHaveCount(0);
    const sliderGeometry = await firstSourceCard.locator("icon-range-slider").evaluate((slider) => {
      const root = slider.shadowRoot;
      const shell = root?.querySelector(".range-shell")?.getBoundingClientRect();
      const thumb = root?.querySelector(".icon-thumb")?.getBoundingClientRect();
      const input = root?.querySelector('input[type="range"]')?.getBoundingClientRect();
      return {
        shellHeight: shell?.height ?? 0,
        thumbWidth: thumb?.width ?? 0,
        inputHeight: input?.height ?? 0,
      };
    });
    expect(sliderGeometry).toEqual({ shellHeight: 32, thumbWidth: 28, inputHeight: 44 });

    const overflow = await settings.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("uses the mobile drawer as the feed switcher and gives snapshots the full strip", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    const tabs = page.locator("feed-page feed-tabs");
    await expect(tabs.locator(".algo-indicator, .algo-trigger, .algo-dropdown")).toHaveCount(0);
    await expect(tabs.locator(".tabs-scroll-area")).toBeVisible();
    await expect(tabs.locator(".tab").first()).toContainText("Latest");

    const geometry = await tabs.locator(".tabs-container").evaluate((container) => {
      const strip = container.querySelector(".tabs-scroll-area")?.getBoundingClientRect();
      const box = container.getBoundingClientRect();
      return {
        stripLeft: strip?.left ?? -1,
        stripRight: strip?.right ?? -1,
        containerLeft: box.left,
        containerRight: box.right,
      };
    });
    expect(Math.abs(geometry.stripLeft - geometry.containerLeft)).toBeLessThan(1);
    expect(Math.abs(geometry.stripRight - geometry.containerRight)).toBeLessThan(1);
  });

  test("keeps the source breakdown readable and horizontally scrollable on mobile", async ({
    page,
  }) => {
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 640 });
      const feedPage = page.locator("feed-page");
      await feedPage.locator("feed-tabs").evaluate(async (element) => {
        const tabs = element as HTMLElement & {
          feeds: Array<Record<string, unknown>>;
          updateComplete: Promise<boolean>;
        };
        const activeFeed = tabs.feeds[0];
        if (!activeFeed) throw new Error("Expected an active feed fixture");
        const diagnostic = {
          weight: 0.25,
          requestedCount: 50,
          returnedCount: 24,
          contributedCount: 10,
          status: "success",
          reason: null,
          mode: "primary",
        };
        tabs.feeds = [
          {
            ...activeFeed,
            generatorDiagnostics: [
              { ...diagnostic, name: "followed_users" },
              { ...diagnostic, name: "network_likes" },
              { ...diagnostic, name: "two_tower" },
              { ...diagnostic, name: "popularity" },
            ],
          },
        ];
        await tabs.updateComplete;
      });
      const openBreakdown = feedPage.getByRole("button", { name: "View source breakdown" });
      await expect(openBreakdown).toBeEnabled();
      await openBreakdown.click();

      const dialog = feedPage.getByRole("dialog", { name: "Source breakdown" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Swipe horizontally to see all columns")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Close source breakdown" })).toBeVisible();

      const geometry = await dialog.evaluate((element) => {
        const dialogBox = element.getBoundingClientRect();
        const scrollElement = element.querySelector<HTMLElement>(".breakdown-table-scroll");
        const sourceCell = scrollElement?.querySelector<HTMLElement>("tbody td:first-child");
        if (scrollElement) scrollElement.scrollLeft = scrollElement.scrollWidth;
        const scrollBox = scrollElement?.getBoundingClientRect();
        const sourceBox = sourceCell?.getBoundingClientRect();
        return {
          dialogLeft: dialogBox.left,
          dialogRight: dialogBox.right,
          dialogClientWidth: element.clientWidth,
          dialogScrollWidth: element.scrollWidth,
          scrollerClientWidth: scrollElement?.clientWidth ?? 0,
          scrollerScrollWidth: scrollElement?.scrollWidth ?? 0,
          scrollerScrollLeft: scrollElement?.scrollLeft ?? 0,
          scrollerLeft: scrollBox?.left ?? 0,
          sourceLeft: sourceBox?.left ?? 0,
          closeSize: (() => {
            const box = element.querySelector(".popover-close")?.getBoundingClientRect();
            return { width: box?.width ?? 0, height: box?.height ?? 0 };
          })(),
        };
      });

      expect(geometry.dialogLeft).toBeGreaterThanOrEqual(0);
      expect(geometry.dialogRight).toBeLessThanOrEqual(width);
      expect(geometry.dialogScrollWidth).toBeLessThanOrEqual(geometry.dialogClientWidth);
      expect(geometry.scrollerScrollWidth).toBeGreaterThan(geometry.scrollerClientWidth);
      expect(geometry.scrollerScrollLeft).toBeGreaterThan(0);
      expect(Math.abs(geometry.sourceLeft - geometry.scrollerLeft)).toBeLessThan(2);
      expect(geometry.closeSize.width).toBeGreaterThanOrEqual(44);
      expect(geometry.closeSize.height).toBeGreaterThanOrEqual(44);

      await dialog.getByRole("button", { name: "Close source breakdown" }).click();
      await expect(dialog).toHaveCount(0);
    }
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
    expect((closeBox?.x ?? 0) - (box?.x ?? 0)).toBeGreaterThan((box?.width ?? 0) / 2);
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

    const name = drawer.locator(".user-details-name, .user-details-handle--primary").first();
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

    await drawer.locator('.algo-btn[aria-label="Best of Friends"]').click();
    await expect(page).toHaveURL(/#\/feed\/best-of-friends$/);
    await expect(drawer).toBeVisible();

    await drawer.getByRole("link", { name: "Settings" }).first().click();
    await expect(page).toHaveURL(/#\/settings\/your-feed$/);
    await expect(drawer).not.toBeVisible();
  });
}
