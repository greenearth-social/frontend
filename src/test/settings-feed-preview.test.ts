import { describe, expect, it } from "vitest";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import {
  previewPageTransition,
  rankMovement,
  SettingsFeedPreview,
} from "../components/settings-feed-preview";
import { countedMediaLabels } from "../utils/media-labels";

function item(atUri: string): FeedItemView {
  return {
    atUri,
    postUrl: null,
    finalPosition: 1,
    author: "@author.test",
    displayName: "Author",
    avatarUrl: null,
    createdAt: "",
    content: "Post",
    mediaLabels: [],
    imageUrls: [],
    videoUrl: null,
    linkCard: null,
    generators: [{ name: "two_tower", score: 1 }],
    rankPosition: null,
    rankScore: null,
    afterRankPosition: null,
    modelScores: [],
    diversification: null,
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
  };
}

describe("settings feed rank movement", () => {
  const before = ["a", "b", "c", "d", "e"].map(item);

  it("uses single and double line chevrons based on absolute movement", () => {
    const after = ["d", "a", "c", "b", "e"].map(item);

    expect(rankMovement("a", before, after)).toMatchObject({
      kind: "down",
      delta: -1,
      icon: "chevron-down",
      label: "Moved down 1 position",
    });
    expect(rankMovement("d", before, after)).toMatchObject({
      kind: "up",
      delta: 3,
      icon: "chevrons-up",
      label: "Moved up 3 positions",
    });
  });

  it("uses a neutral minus for unchanged posts and a seedling for additions", () => {
    const after = ["a", "new", "c", "d", "e"].map(item);

    expect(rankMovement("a", before, after)).toEqual({
      kind: "unchanged",
      delta: 0,
      icon: "minus",
      label: "Rank unchanged",
    });
    expect(rankMovement("new", before, after)).toEqual({
      kind: "new",
      delta: null,
      icon: "seedling",
      label: "New post",
    });
  });
});

describe("settings feed content badges", () => {
  it("uses the exact counted media labels shared with WAIST", () => {
    const mediaItem = item("media");
    mediaItem.mediaLabels = ["image", "image", "video", "link"];
    mediaItem.imageUrls = ["one.jpg", "two.jpg"];
    mediaItem.videoUrl = "video.mp4";
    mediaItem.linkCard = { title: "Link", description: "", imageUrl: "" };

    expect(countedMediaLabels(mediaItem)).toEqual(["2 images", "1 video", "1 link"]);
    expect(countedMediaLabels(item("text"))).toEqual([]);
  });

  it("renders neutral content pills instead of generator names", async () => {
    const mediaItem = item("media-card");
    mediaItem.mediaLabels = ["image"];
    mediaItem.imageUrls = ["one.jpg"];
    const element = document.createElement("settings-feed-preview");
    element.items = [mediaItem];
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".content-pill")?.textContent).toBe("1 image");
    expect(element.shadowRoot?.textContent).not.toContain("two_tower");
    expect(SettingsFeedPreview.styles.cssText).toContain("border: 1px solid var(--source-border)");
    expect(SettingsFeedPreview.styles.cssText).toContain("color: var(--source-color)");
    element.remove();
  });
});

describe("settings feed movement presentation", () => {
  it("settles an incoming feed baseline after the previous feed is cleared", async () => {
    const element = document.createElement("settings-feed-preview");
    element.items = ["feed-a-1", "feed-a-2"].map(item);
    document.body.appendChild(element);
    await element.updateComplete;

    element.items = [];
    await element.updateComplete;
    element.items = ["feed-b-1", "feed-b-2"].map(item);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll(".movement.unchanged")).toHaveLength(2);
    expect(element.shadowRoot?.querySelector(".movement.new")).toBeNull();
    element.remove();
  });

  it("uses outcome colors and settles a restored slate to unchanged markers", async () => {
    const before = ["a", "b", "c"].map(item);
    const after = ["c", "a", "new"].map(item);
    const element = document.createElement("settings-feed-preview");
    element.items = before;
    document.body.appendChild(element);
    await element.updateComplete;

    element.items = after;
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector(".movement.up")).not.toBeNull();
    expect(element.shadowRoot?.querySelector(".movement.new")?.getAttribute("aria-label")).toBe(
      "New post",
    );

    element.settleAsOrigin(after);
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll(".movement.unchanged")).toHaveLength(3);
    expect(
      element.shadowRoot?.querySelector(".movement.up, .movement.down, .movement.new"),
    ).toBeNull();
    expect(SettingsFeedPreview.styles.cssText).toContain("var(--bluesky-brand, #1083fe)");
    expect(SettingsFeedPreview.styles.cssText).toContain("var(--bluesky-danger, #f4212e)");
    expect(SettingsFeedPreview.styles.cssText).toContain("var(--bluesky-repost, #00ba7c)");
    element.remove();
  });

  it("classifies page-boundary survivors separately from removals and new posts", () => {
    const before = Array.from({ length: 30 }, (_, index) => item(`post-${String(index + 1)}`));
    const after = [
      item("brand-new"),
      ...before.slice(20, 22),
      ...before.slice(1, 18),
      ...before.slice(18, 20),
      ...before.slice(22),
    ];

    expect(previewPageTransition(before, after)).toEqual({
      removed: ["post-1"],
      leavingPage: ["post-19", "post-20"],
      enteringPage: ["post-21", "post-22"],
      added: ["brand-new"],
    });
  });

  it("paginates every returned item and shows hydration counts", async () => {
    const element = document.createElement("settings-feed-preview");
    element.items = Array.from({ length: 45 }, (_, index) => item(`post-${String(index + 1)}`));
    element.filteringCounts = {
      storedItemCount: 50,
      displayedItemCount: 45,
      publiclyFilteredCount: 2,
      unavailableCount: 3,
    };
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll(".card")).toHaveLength(20);
    expect(element.shadowRoot?.querySelector(".slate-summary")?.textContent).toContain(
      "45 available of 50 ranked",
    );
    expect(
      element.shadowRoot?.querySelector(".filter-summary")?.textContent.replace(/\s+/g, " "),
    ).toContain("2 filtered · 3 unavailable");
    expect(element.shadowRoot?.querySelector(".pagination")?.textContent).toContain("Page 1 of 3");

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('button[aria-label="Next preview page"]')
      ?.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll(".card")).toHaveLength(20);
    expect(element.shadowRoot?.querySelector(".pagination")?.textContent).toContain("Page 2 of 3");

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('button[aria-label="Next preview page"]')
      ?.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll(".card")).toHaveLength(5);
    expect(element.shadowRoot?.querySelector(".pagination")?.textContent).toContain("Page 3 of 3");
    element.remove();
  });
});
