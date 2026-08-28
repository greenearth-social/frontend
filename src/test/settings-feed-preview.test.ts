import { describe, expect, it, vi } from "vitest";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import {
  deletionCascadeDelay,
  previewPageTransition,
  PREVIEW_ANIMATION_TIMINGS,
  rankMovement,
  revealCascadeDelay,
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

  it("renders the candidate before movement and content pills below post text", async () => {
    const mediaItem = item("media-card");
    mediaItem.mediaLabels = ["image"];
    mediaItem.imageUrls = ["one.jpg"];
    const element = document.createElement("settings-feed-preview");
    element.items = [mediaItem];
    document.body.appendChild(element);
    await element.updateComplete;

    const metadata = element.shadowRoot?.querySelector(".metadata");
    const candidate = metadata?.querySelector(".candidate-pill");
    const movement = metadata?.querySelector(".movement");
    expect(candidate?.textContent).toBe("Author/Topic");
    expect(candidate?.nextElementSibling).toBe(movement);
    expect(element.shadowRoot?.querySelector(".content-pill")?.textContent).toBe("1 image");
    const snippet = element.shadowRoot?.querySelector(".snippet");
    expect(snippet?.nextElementSibling?.classList.contains("content-row")).toBe(true);
    expect(SettingsFeedPreview.styles.cssText).toContain("border: 1px solid var(--source-border)");
    expect(SettingsFeedPreview.styles.cssText).toContain("color: var(--source-color)");
    expect(SettingsFeedPreview.styles.cssText).toContain("max-height: 8rem");
    element.remove();
  });
});

describe("settings feed movement presentation", () => {
  it("uses the 1.5x animation timings and reduced-motion crossfade", () => {
    expect(PREVIEW_ANIMATION_TIMINGS).toEqual({
      fadeOut: 450,
      fadeOutStagger: 225,
      removeSpace: 400,
      rerank: 1550,
      insertSpace: 400,
      fadeIn: 450,
      fadeInStagger: 225,
      reducedMotion: 160,
    });
    expect(SettingsFeedPreview.styles.cssText).toContain("min-height 400ms ease");
    expect(SettingsFeedPreview.styles.cssText).toContain("opacity 450ms ease");
    expect(SettingsFeedPreview.styles.cssText).toContain(
      "transition-delay: var(--removal-delay, 0ms)",
    );
    expect(SettingsFeedPreview.styles.cssText).toContain("animation: open-card 400ms ease both");
    expect(SettingsFeedPreview.styles.cssText).toContain("animation: reveal-card 450ms ease both");
    expect(SettingsFeedPreview.styles.cssText).toContain(
      "animation-delay: var(--reveal-delay, 0ms)",
    );
  });

  it("starts each top-to-bottom deletion fade when the previous fade is halfway done", () => {
    expect(deletionCascadeDelay(0, 4)).toBe(0);
    expect(deletionCascadeDelay(1, 4)).toBe(225);
    expect(deletionCascadeDelay(2, 4)).toBe(450);
    expect(deletionCascadeDelay(3, 4)).toBe(675);
  });

  it("starts each top-to-bottom reveal when the previous reveal is halfway done", () => {
    expect(revealCascadeDelay(0, 4)).toBe(0);
    expect(revealCascadeDelay(1, 4)).toBe(225);
    expect(revealCascadeDelay(2, 4)).toBe(450);
    expect(revealCascadeDelay(3, 4)).toBe(675);
  });

  it("fades departures before removing their space and reordering full cards", async () => {
    vi.useFakeTimers();
    const animationResolvers: Array<() => void> = [];
    const originalAnimate = HTMLElement.prototype.animate;
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(() => ({
        finished: new Promise<void>((resolve) => animationResolvers.push(resolve)),
      })),
    });
    const element = document.createElement("settings-feed-preview");
    element.items = ["a", "b", "c"].map(item);
    document.body.appendChild(element);
    await element.updateComplete;

    try {
      const finished = element.animateTo(["c", "b", "new"].map(item));
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(".feed")?.classList).toContain("fade-out");
      expect(element.shadowRoot?.querySelectorAll(".fade-out .card.removed")).toHaveLength(1);
      expect(element.shadowRoot?.querySelectorAll(".fade-out .card:not(.removed)")).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.fadeOut);
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(".feed")?.classList).toContain("compact");
      expect(element.shadowRoot?.querySelectorAll(".compact .card")).toHaveLength(3);
      expect(SettingsFeedPreview.styles.cssText).not.toContain(".compact .snippet");
      expect(SettingsFeedPreview.styles.cssText).not.toContain(".rerank .snippet");
      expect(SettingsFeedPreview.styles.cssText).toContain(".compact .card.removed");

      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.removeSpace);
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(".feed")?.classList).toContain("rerank");
      expect(HTMLElement.prototype.animate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          duration: PREVIEW_ANIMATION_TIMINGS.rerank,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        }),
      );

      animationResolvers.splice(0).forEach((resolve) => {
        resolve();
      });
      for (let index = 0; index < 4; index++) await Promise.resolve();
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(".feed")?.classList).toContain("insert-space");

      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.insertSpace);
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(".feed")?.classList).toContain("fade-in");

      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.fadeIn);
      await finished;
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(".feed")?.classList).toContain("idle");
    } finally {
      element.remove();
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: originalAnimate,
      });
      vi.useRealTimers();
    }
  });

  it("skips the rerank pause when surviving posts keep their order", async () => {
    vi.useFakeTimers();
    const originalAnimate = HTMLElement.prototype.animate;
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    const element = document.createElement("settings-feed-preview");
    element.items = ["a", "b", "c"].map(item);
    document.body.appendChild(element);
    await element.updateComplete;

    try {
      const finished = element.animateTo(["b", "c", "new"].map(item));
      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.fadeOut);
      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.removeSpace);
      await element.updateComplete;

      expect(animate).not.toHaveBeenCalled();
      expect(element.shadowRoot?.querySelector(".feed")?.classList).toContain("insert-space");

      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.insertSpace);
      await vi.advanceTimersByTimeAsync(PREVIEW_ANIMATION_TIMINGS.fadeIn);
      await finished;
    } finally {
      element.remove();
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: originalAnimate,
      });
      vi.useRealTimers();
    }
  });

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

  it("limits transitions to the currently visible preview page", () => {
    const before = Array.from({ length: 40 }, (_, index) => item(`post-${String(index + 1)}`));
    const after = [
      ...before.slice(0, 19),
      item("first-page-new"),
      ...before.slice(20, 39),
      item("second-page-new"),
    ];

    expect(previewPageTransition(before, after, 2)).toEqual({
      removed: ["post-40"],
      leavingPage: [],
      enteringPage: [],
      added: ["second-page-new"],
    });
  });

  it("adopts off-page changes without animating them", async () => {
    const before = Array.from({ length: 40 }, (_, index) => item(`post-${String(index + 1)}`));
    const after = [item("off-page-new"), ...before.slice(1)];
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const element = document.createElement("settings-feed-preview");
    element.items = before;
    document.body.appendChild(element);
    await element.updateComplete;
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('button[aria-label="Next preview page"]')
      ?.click();
    await element.updateComplete;
    const animation = vi.spyOn(element, "animate").mockReturnValue({
      finished: Promise.resolve(),
    } as unknown as Animation);

    try {
      await element.animateTo(after);
      element.shadowRoot
        ?.querySelector<HTMLButtonElement>('button[aria-label="Previous preview page"]')
        ?.click();
      await element.updateComplete;

      expect(element.shadowRoot?.querySelector<HTMLElement>(".card")?.dataset.uri).toBe(
        "off-page-new",
      );
    } finally {
      animation.mockRestore();
      matchMedia.mockRestore();
      element.remove();
    }
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
      "45 shown of 50 ranked",
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
