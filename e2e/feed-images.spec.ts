import { expect, test } from "@playwright/test";
import type { FeedItemCard } from "../src/components/feed-item-card";

const landscape = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#bde6f4"/>
  <circle cx="620" cy="100" r="52" fill="#ffe59a"/>
  <path d="M0 360L210 130L420 360L610 210L800 350V500H0Z" fill="#368b70"/>
  <path d="M0 420L260 290L500 420L800 300V500H0Z" fill="#215e50"/>
</svg>`;
const portrait = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="700" viewBox="0 0 300 700">
  <rect width="300" height="700" fill="#f8f5ea"/>
  <rect x="24" y="24" width="252" height="80" rx="8" fill="#368b70"/>
  <path d="M30 150H270M30 190H240M30 230H260M30 270H220M30 310H270M30 350H240" stroke="#708080" stroke-width="10"/>
  <rect x="30" y="410" width="240" height="230" rx="8" fill="#bde6f4"/>
</svg>`;

test.beforeEach(async ({ page }) => {
  await page.route("https://picsum.photos/**", async (route) => {
    if (route.request().url().includes("missing")) {
      await route.fulfill({ status: 404, body: "Image not found" });
      return;
    }
    await route.fulfill({
      contentType: "image/svg+xml",
      body: route.request().url().includes("portrait") ? portrait : landscape,
    });
  });
  await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("feed-item-card");
});

test("keeps images bounded beside desktop text and above mobile text", async ({
  page,
}, testInfo) => {
  const card = page.locator("feed-item-card").first();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const count of [1, 2, 3, 4]) {
      await card.evaluate(async (element, imageCount) => {
        const cardElement = element as FeedItemCard;
        if (!cardElement.item) throw new Error("Expected a post");
        cardElement.item = {
          ...cardElement.item,
          imageUrls: Array.from({ length: imageCount }, (_, index) =>
            index === 0
              ? "https://picsum.photos/seed/portrait/300/700"
              : `https://picsum.photos/seed/landscape${String(index)}/800/500`,
          ),
          content:
            "A few observations from today's walk. Images stay together while the explanation remains easy to read.\n\n" +
            "A long link should wrap inside the text column: https://example.test/" +
            "long-post-address-".repeat(12),
        };
        await cardElement.updateComplete;
      }, count);
      await expect(card.locator(".post-image")).toHaveCount(count);
      await expect
        .poll(() =>
          card
            .locator(".post-image")
            .evaluateAll((images) =>
              images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
            ),
        )
        .toBe(true);

      const body = await card.locator(".post-body").boundingBox();
      const gallery = await card.locator(".media-gallery").boundingBox();
      const text = await card.locator(".post-content").boundingBox();
      const author = await card.locator(".author-row").boundingBox();
      const details = await card.locator(".chart-section").boundingBox();
      if (!body || !gallery || !text || !author || !details) {
        throw new Error("Expected all card sections");
      }
      expect(gallery.height).toBeLessThanOrEqual(320);
      expect(gallery.y).toBeGreaterThanOrEqual(author.y + author.height);
      expect(details.y).toBeGreaterThanOrEqual(body.y + body.height);
      if (width === 1440) {
        expect(Math.abs(gallery.y - text.y)).toBeLessThan(1);
        expect(Math.abs(gallery.width - text.width)).toBeLessThan(1);
        expect(text.x - gallery.x - gallery.width).toBeCloseTo(16, 0);
      } else {
        expect(Math.abs(gallery.width - body.width)).toBeLessThan(1);
        expect(text.y - gallery.y - gallery.height).toBeCloseTo(16, 0);
      }
      for (const selector of [".card", ".post-body", ".post-content"]) {
        const overflow = await card.locator(selector).evaluate((element) => ({
          client: element.clientWidth,
          scroll: element.scrollWidth,
        }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
      }
      await expect(card.locator(".post-image").first()).toHaveCSS("object-fit", "contain");
      await expect(card.locator(".content-badge")).toHaveCount(0);
      if ((width === 1440 && count === 4) || (width === 390 && count === 1)) {
        await card.screenshot({ path: testInfo.outputPath(`images-${String(width)}px.png`) });
      }
    }
  }
});

test("switches layout at 640px of card content width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const card = page.locator("feed-item-card").first();
  for (const width of [639, 640]) {
    await card.locator(".card").evaluate((element, contentWidth) => {
      (element as HTMLElement).style.width = `${String(contentWidth)}px`;
    }, width);
    const gallery = await card.locator(".media-gallery").boundingBox();
    const text = await card.locator(".post-content").boundingBox();
    if (!gallery || !text) throw new Error("Expected images and text");
    if (width === 639) expect(text.y).toBeGreaterThan(gallery.y);
    else expect(text.y).toBe(gallery.y);
  }

  await card.getByRole("button", { name: "Explain post sources", exact: true }).click();
  const dialog = card.getByRole("dialog", { name: "Post sources" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  if (!dialogBox) throw new Error("Expected source dialog");
  expect(dialogBox.x + dialogBox.width / 2).toBeCloseTo(720, 0);
  expect(dialogBox.y + dialogBox.height / 2).toBeCloseTo(500, 0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("opens the Bluesky post from the keyboard and keeps failed images linked", async ({
  page,
}) => {
  const card = page.locator("feed-item-card").first();
  await card.evaluate(async (element) => {
    const cardElement = element as FeedItemCard;
    if (!cardElement.item) throw new Error("Expected a post");
    cardElement.item = {
      ...cardElement.item,
      imageUrls: ["https://picsum.photos/seed/missing/600/400"],
    };
    await cardElement.updateComplete;
  });
  await expect(card.getByText("Image unavailable")).toBeVisible();
  const link = card.locator("a.media-tile");
  const postUrl = await card.locator(".bluesky-btn").getAttribute("href");
  await expect(link).toHaveAttribute("href", postUrl ?? "");
  await page.context().route("https://bsky.app/**", async (route) => {
    await route.fulfill({ contentType: "text/html", body: "Bluesky post" });
  });
  await link.focus();
  await expect(link).toBeFocused();
  const popupPromise = page.waitForEvent("popup");
  await link.press("Enter");
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toBe(postUrl);
  await popup.close();
});
