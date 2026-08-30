import { describe, expect, it, vi } from "vitest";
import { FeedTabs } from "../components/feed-tabs";

function makeTabs() {
  const element = document.createElement("feed-tabs");
  element.activeRequestId = "req-1";
  element.feeds = [
    {
      requestId: "req-1",
      generatedAt: "2026-07-16T12:00:00Z",
      feedName: "your-feed",
      apiReleaseSha: "api-sha-1",
      appliedSocialRadius: 0,
      generatorDiagnostics: [
        {
          name: "followed_users",
          weight: 0.7,
          requestedCount: 70,
          returnedCount: 12,
          contributedCount: 10,
          status: "success",
          reason: null,
          mode: "primary",
        },
      ],
    },
    {
      requestId: "req-2",
      generatedAt: "2026-07-16T11:00:00Z",
      feedName: "your-feed",
      apiReleaseSha: "api-sha-2",
      appliedSocialRadius: 3,
      generatorDiagnostics: [],
    },
  ];
  document.body.appendChild(element);
  return element;
}

describe("FeedTabs source breakdown", () => {
  it("opens a breakdown without selecting the snapshot", async () => {
    const element = makeTabs();
    const changed = vi.fn();
    element.addEventListener("tab-change", changed);
    await element.updateComplete;

    element.showActiveBreakdown();
    await element.updateComplete;

    expect(changed).not.toHaveBeenCalled();
    expect(element.shadowRoot?.querySelectorAll(".breakdown-button")).toHaveLength(0);
    const dialogText = element.shadowRoot?.querySelector("dialog")?.textContent;
    expect(dialogText).toContain("Following");
    expect(dialogText).not.toContain("followed_users");
    element.remove();
  });

  it("stays open when triggered by the header button outside the tabs", async () => {
    const element = makeTabs();
    const externalButton = document.createElement("button");
    externalButton.addEventListener("click", (event) => {
      element.showActiveBreakdown(event);
    });
    document.body.appendChild(externalButton);
    await element.updateComplete;

    externalButton.click();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector("dialog")?.textContent).toContain("Following");
    externalButton.remove();
    element.remove();
  });

  it("orders sources to match Settings", async () => {
    const element = makeTabs();
    const feed = element.feeds[0];
    if (!feed) throw new Error("Expected feed fixture");
    const diagnostic = feed.generatorDiagnostics[0];
    if (!diagnostic) throw new Error("Expected diagnostic fixture");
    element.feeds = [
      {
        ...feed,
        generatorDiagnostics: [
          { ...diagnostic, name: "popularity" },
          { ...diagnostic, name: "two_tower" },
          { ...diagnostic, name: "followed_users" },
          { ...diagnostic, name: "network_likes" },
        ],
      },
      ...element.feeds.slice(1),
    ];
    await element.updateComplete;

    element.showActiveBreakdown();
    await element.updateComplete;

    const tableText = element.shadowRoot?.querySelector("tbody")?.textContent ?? "";
    const sourceNames = Array.from(
      tableText.matchAll(/(Followed Likes|Following|Author\/Topic|Popular)\s+70%/g),
      (match) => match[1],
    );
    expect(sourceNames).toEqual(["Following", "Followed Likes", "Author/Topic", "Popular"]);
    element.remove();
  });

  it("shows filtering counts for a hydrated snapshot", async () => {
    const element = makeTabs();
    element.filteringCountsByRequest = {
      "req-1": {
        storedItemCount: 10,
        displayedItemCount: 7,
        publiclyFilteredCount: 2,
        unavailableCount: 1,
      },
    };
    await element.updateComplete;

    element.showActiveBreakdown();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector("dialog")?.textContent).toContain(
      "Snapshot stored 10 posts",
    );
    expect(element.shadowRoot?.querySelector("dialog")?.textContent.replace(/\s+/g, " ")).toContain(
      "Public labels filtered 2",
    );
    element.remove();
  });

  it("keeps only one breakdown open and closes it with Escape", async () => {
    const element = makeTabs();
    await element.updateComplete;
    element.showActiveBreakdown();
    await element.updateComplete;
    element.activeRequestId = "req-2";
    await element.updateComplete;
    element.showActiveBreakdown();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll("dialog")).toHaveLength(1);
    expect(element.shadowRoot?.querySelector("dialog")?.textContent).toContain("Balanced");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector("dialog")).toBeNull();
    element.remove();
  });

  it("uses the viewport top layer instead of tab-relative coordinates", async () => {
    const element = makeTabs();
    await element.updateComplete;

    element.showActiveBreakdown();
    await element.updateComplete;

    const dialog = element.shadowRoot?.querySelector<HTMLDialogElement>("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog?.style.left).toBe("");
    expect(dialog?.style.top).toBe("");
    expect(FeedTabs.styles.cssText).toContain("position: fixed");
    expect(FeedTabs.styles.cssText).toContain("left: 50%");
    expect(FeedTabs.styles.cssText).toContain("::backdrop");
    element.remove();
  });

  it("keeps the mobile diagnostics table inside its own horizontal scroller", async () => {
    const element = makeTabs();
    await element.updateComplete;

    element.showActiveBreakdown();
    await element.updateComplete;

    const root = element.shadowRoot;
    const scroller = root?.querySelector<HTMLElement>(".breakdown-table-scroll");
    expect(scroller?.getAttribute("role")).toBe("region");
    expect(scroller?.getAttribute("aria-label")).toBe("Source diagnostics table");
    expect(scroller?.querySelector("table")).not.toBeNull();
    expect(root?.querySelector(".table-scroll-hint")?.textContent).toContain("Swipe horizontally");
    expect(FeedTabs.styles.cssText).toMatch(
      /\.breakdown-table-scroll\s*\{[^}]*overflow-x:\s*auto/s,
    );
    expect(FeedTabs.styles.cssText).toMatch(
      /th:first-child,\s*td:first-child\s*\{[^}]*position:\s*sticky[^}]*left:\s*0/s,
    );
    expect(FeedTabs.styles.cssText).toMatch(
      /@media\s*\(max-width:\s*480px\)[\s\S]*width:\s*calc\(100vw\s*-\s*0\.75rem\)/,
    );

    root?.querySelector<HTMLButtonElement>(".popover-close")?.click();
    await element.updateComplete;
    expect(root?.querySelector("dialog")).toBeNull();
    element.remove();
  });

  it("keeps the snapshot strip and its edge fades without a redundant feed selector", async () => {
    const element = makeTabs();
    await element.updateComplete;

    const root = element.shadowRoot;
    expect(root?.querySelector(".algo-indicator, .algo-trigger, .algo-dropdown")).toBeNull();
    expect(root?.querySelector(".tabs-scroll-area")).not.toBeNull();
    expect(root?.querySelector(".tabs-wrapper")).not.toBeNull();
    expect(root?.querySelectorAll(".tab")).toHaveLength(2);
    expect(root?.querySelector(".tab")?.textContent).toContain("Latest");
    expect(FeedTabs.styles.cssText).toContain(".tabs-scroll-area::before");
    expect(FeedTabs.styles.cssText).toContain(".tabs-scroll-area::after");
    expect(FeedTabs.styles.cssText).toContain("overflow-x: auto");

    element.remove();
  });

  it("keeps the full-width snapshot strip when the selected feed has no snapshots", async () => {
    const element = document.createElement("feed-tabs");
    element.feeds = [];
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".algo-trigger")).toBeNull();
    expect(element.shadowRoot?.querySelector(".tabs-scroll-area")).not.toBeNull();
    expect(element.shadowRoot?.querySelectorAll(".tab")).toHaveLength(0);
    expect(FeedTabs.styles.cssText).toContain("min-height: 2.75rem");
    element.remove();
  });
});
