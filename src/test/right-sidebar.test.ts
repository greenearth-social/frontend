import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedSummary } from "../models/feed-debug-snapshot";
import { RightSidebar } from "../components/right-sidebar";

function makeFeed(feedName: string, hoursAgo: number): FeedSummary {
  const d = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return {
    requestId: `req-${hoursAgo}`,
    generatedAt: d.toISOString(),
    feedName,
    appliedSocialRadius: null,
    generatorDiagnostics: [],
  };
}

describe("RightSidebar", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shows only feeds matching selectedAlgorithm", async () => {
    const el = document.createElement("right-sidebar") as RightSidebar;
    el.feeds = [makeFeed("your-feed", 1), makeFeed("best-of-friends", 2)];
    el.selectedAlgorithm = "your-feed";
    el.activeRequestId = null;
    el.blueskyUrl = "https://bsky.app/profile/did/feed/a0-yf";
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot?.querySelectorAll(".feed-item");
    expect(items?.length).toBe(1);
  });

  it("shows stale notice when no feeds for algorithm within 24h", async () => {
    const el = document.createElement("right-sidebar") as RightSidebar;
    el.feeds = [makeFeed("your-feed", 25)];
    el.selectedAlgorithm = "your-feed";
    el.activeRequestId = null;
    el.blueskyUrl = "https://bsky.app/profile/did/feed/a0-yf";
    document.body.appendChild(el);
    await el.updateComplete;

    const notice = el.shadowRoot?.querySelector(".stale-notice");
    expect(notice).toBeTruthy();
    const link = el.shadowRoot?.querySelector<HTMLAnchorElement>(".open-in-bluesky");
    expect(link?.href).toContain("bsky.app");
    expect(link?.textContent?.trim()).toBe("Open in Bluesky");
  });

  it("shows stale notice when feed list for algorithm is empty", async () => {
    const el = document.createElement("right-sidebar") as RightSidebar;
    el.feeds = [makeFeed("best-of-friends", 1)];
    el.selectedAlgorithm = "your-feed";
    el.activeRequestId = null;
    el.blueskyUrl = "https://bsky.app/profile/did/feed/a0-yf";
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector(".stale-notice")).toBeTruthy();
  });

  it("shows feed list when at least one feed is within 24h", async () => {
    const el = document.createElement("right-sidebar") as RightSidebar;
    el.feeds = [makeFeed("your-feed", 1), makeFeed("your-feed", 30)];
    el.selectedAlgorithm = "your-feed";
    el.activeRequestId = null;
    el.blueskyUrl = "https://bsky.app/profile/did/feed/a0-yf";
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector(".stale-notice")).toBeFalsy();
    const items = el.shadowRoot?.querySelectorAll(".feed-item");
    expect(items?.length).toBe(2);
  });
});
