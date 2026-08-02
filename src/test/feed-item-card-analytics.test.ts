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

describe("FeedItemCard analytics", () => {
  beforeEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    testState.rootStore.services.analyticsService.capture.mockReset();
  });

  it("captures an outbound Bluesky post click without post content", async () => {
    const items = transformFeedItems((sampleFixture as unknown as { items: ApiFeedItem[] }).items);
    const item = items.find((candidate) => candidate.postUrl !== null);
    if (!item) throw new Error("Fixture has no Bluesky post URL");
    const element = document.createElement("feed-item-card");
    element.item = item;
    document.body.appendChild(element);
    await element.updateComplete;

    const link = element.shadowRoot?.querySelector<HTMLAnchorElement>(".bluesky-btn");
    link?.addEventListener("click", (event) => {
      event.preventDefault();
    });
    link?.click();

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
  });

  it("shows a compact post age and counted media labels", async () => {
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
      mediaLabels: ["image", "video", "link", "2 videos", "3 links"],
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
    ).toEqual(["2 images", "1 video", "1 link", "2 videos", "3 links"]);
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
});
