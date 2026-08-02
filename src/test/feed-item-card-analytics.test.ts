import { beforeEach, describe, expect, it, vi } from "vitest";
import sampleFixture from "./fixtures/sample-feed-debug.json";
import {
  transformFeedItems,
  type ApiFeedItem,
} from "../models/feed-debug-snapshot";

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
    document.body.replaceChildren();
    testState.rootStore.services.analyticsService.capture.mockReset();
  });

  it("captures an outbound Bluesky post click without post content", async () => {
    const items = transformFeedItems(
      (sampleFixture as unknown as { items: ApiFeedItem[] }).items,
    );
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
      JSON.stringify(
        testState.rootStore.services.analyticsService.capture.mock.calls,
      ),
    ).not.toContain(item.content);
  });
});
