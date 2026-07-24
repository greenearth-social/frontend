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
    expect(element.shadowRoot?.querySelector("dialog")?.textContent).toContain("followed_users");
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
    expect(element.shadowRoot?.querySelector("dialog")?.textContent).toContain(
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
});
