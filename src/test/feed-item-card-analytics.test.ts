import { beforeEach, describe, expect, it, vi } from "vitest";
import sampleFixture from "./fixtures/sample-feed-debug.json";
import { transformFeedItems, type ApiFeedItem } from "../models/feed-debug-snapshot";

const testState = vi.hoisted(() => ({
  capture: vi.fn(),
  rootStore: {
    feedStore: {
      currentRequestId: "request-1",
      feedList: [{ requestId: "request-1", feedName: "your-feed" }],
    },
    services: { analyticsService: { capture: vi.fn() } },
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import "../components/feed-item-card";

describe("FeedItemCard", () => {
  beforeEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    testState.rootStore.services.analyticsService.capture.mockReset();
  });

  it.each([".bluesky-btn", ".media-tile"])(
    "captures a click on %s once without post content",
    async (selector) => {
      const items = transformFeedItems(
        (sampleFixture as unknown as { items: ApiFeedItem[] }).items,
      );
      const item = items.find((candidate) => candidate.postUrl !== null);
      if (!item) throw new Error("Fixture has no Bluesky post URL");
      const element = document.createElement("feed-item-card");
      element.item = item;
      document.body.appendChild(element);
      await element.updateComplete;

      const link = element.shadowRoot?.querySelector<HTMLAnchorElement>(selector);
      expect(link?.href).toBe(item.postUrl);
      expect(link?.target).toBe("_blank");
      expect(link?.rel).toBe("noopener noreferrer");
      link?.addEventListener("click", (event) => {
        event.preventDefault();
      });
      link?.click();

      expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledTimes(1);
      expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
        "postOpenedInBluesky",
        {
          item_uri: item.atUri,
          feed_name: "your-feed",
          final_position: item.finalPosition,
        },
      );
      expect(
        JSON.stringify(testState.rootStore.services.analyticsService.capture.mock.calls),
      ).not.toContain(item.content);
    },
  );

  it("shows a compact post age and non-image media labels", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T16:00:00Z"));
    const items = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    const item = items[0];
    if (!item) throw new Error("Fixture has no posts");

    const element = document.createElement("feed-item-card");
    element.item = {
      ...item,
      createdAt: "2026-08-02T12:00:00Z",
      imageUrls: ["one.jpg", "two.jpg"],
      videoUrl: "video.mp4",
      linkCard: { title: "Example", description: "", imageUrl: "" },
      mediaLabels: ["image", "1 image", "2 images", "video", "link", "2 videos", "3 links"],
    };
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector("time")?.textContent).toBe("4h");
    expect(element.shadowRoot?.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-08-02T12:00:00Z",
    );
    expect(
      Array.from(element.shadowRoot?.querySelectorAll(".content-badge") ?? []).map(
        (badge) => badge.textContent,
      ),
    ).toEqual(["1 video", "1 link", "2 videos", "3 links"]);
    vi.useRealTimers();
  });

  it("does not show pills for media labels with no corresponding items", async () => {
    const items = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    const item = items[0];
    if (!item) throw new Error("Fixture has no posts");

    const element = document.createElement("feed-item-card");
    element.item = {
      ...item,
      imageUrls: [],
      videoUrl: null,
      linkCard: null,
      mediaLabels: ["image", "video", "link"],
    };
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll(".content-badge")).toHaveLength(0);
  });

  it("aggregates repeated bare media labels into one counted pill", async () => {
    const items = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    const item = items[0];
    if (!item) throw new Error("Fixture has no posts");

    const element = document.createElement("feed-item-card");
    element.item = {
      ...item,
      videoUrl: null,
      linkCard: null,
      mediaLabels: ["video", "video", "link", "link", "link"],
    };
    document.body.appendChild(element);
    await element.updateComplete;

    expect(
      Array.from(element.shadowRoot?.querySelectorAll(".content-badge") ?? []).map(
        (badge) => badge.textContent,
      ),
    ).toEqual(["2 videos", "3 links"]);
  });

  it("renders every image below the author and above the ranking details", async () => {
    const [item] = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    if (!item) throw new Error("Fixture has no posts");
    const element = document.createElement("feed-item-card");
    element.item = { ...item, imageUrls: ["one.jpg", "two.jpg", "three.jpg", "four.jpg"] };
    document.body.appendChild(element);
    await element.updateComplete;

    const images = element.shadowRoot?.querySelectorAll<HTMLImageElement>(".post-image");
    expect(images).toHaveLength(4);
    images?.forEach((image, index) => {
      expect(image.getAttribute("src")).toBe(element.item?.imageUrls[index]);
      expect(image.loading).toBe("lazy");
      expect(image.decoding).toBe("async");
      expect(image.getAttribute("width")).toBe("640");
      expect(image.getAttribute("height")).toBe("480");
      expect(image.alt).toContain(`Image ${String(index + 1)} of 4`);
      expect(image.closest("a")?.getAttribute("aria-label")).toContain("Open post");
    });
    expect(element.shadowRoot?.querySelector(".post-body.has-images-and-text")).not.toBeNull();
    const sections = Array.from(element.shadowRoot?.querySelector(".card")?.children ?? []);
    expect(sections.map((section) => section.className)).toEqual([
      "author-row",
      "post-body-container",
      "chart-section",
    ]);
  });

  it("keeps failed images linked and resets failures when the post changes", async () => {
    const [item] = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    if (!item) throw new Error("Fixture has no posts");
    const element = document.createElement("feed-item-card");
    element.item = { ...item, imageUrls: ["one.jpg", "two.jpg"] };
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot?.querySelector(".post-image")?.dispatchEvent(new Event("error"));
    await element.updateComplete;

    const fallback = element.shadowRoot?.querySelector(".image-unavailable");
    expect(fallback?.textContent).toContain("Image unavailable");
    expect(fallback?.closest("a")?.href).toBe(item.postUrl);
    expect(element.shadowRoot?.querySelectorAll(".post-image")).toHaveLength(1);

    element.item = { ...item, atUri: "at://another-post", imageUrls: ["one.jpg"] };
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector(".image-unavailable")).toBeNull();
    expect(element.shadowRoot?.querySelectorAll(".post-image")).toHaveLength(1);
  });

  it("shows image-only posts without an empty text column or a link when there is no post URL", async () => {
    const [item] = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    if (!item) throw new Error("Fixture has no posts");
    const element = document.createElement("feed-item-card");
    element.item = { ...item, postUrl: null, content: "", imageUrls: ["one.jpg"] };
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".post-image")).not.toBeNull();
    expect(element.shadowRoot?.querySelector(".single-image")).not.toBeNull();
    expect(element.shadowRoot?.querySelector(".has-images-and-text")).toBeNull();
    expect(element.shadowRoot?.querySelector(".post-content")).toBeNull();
    expect(element.shadowRoot?.querySelector(".media-gallery a")).toBeNull();
  });

  it("keeps text-only and video-only posts free of galleries and players", async () => {
    const items = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    const element = document.createElement("feed-item-card");
    document.body.appendChild(element);
    for (const videoUrl of [null, "video.mp4"]) {
      const item = items[0];
      if (!item) throw new Error("Fixture has no posts");
      element.item = { ...item, imageUrls: [], videoUrl };
      await element.updateComplete;

      expect(element.shadowRoot?.querySelector(".post-content")?.textContent).toBe(item.content);
      expect(element.shadowRoot?.querySelector(".has-images-and-text")).toBeNull();
      expect(element.shadowRoot?.querySelector(".media-gallery, video, iframe")).toBeNull();
    }
  });
});
