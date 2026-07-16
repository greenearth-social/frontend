import { describe, expect, it, vi } from "vitest";
import "../components/feed-tabs";

function makeTabs() {
  const element = document.createElement("feed-tabs");
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
          returnedCount: 0,
          contributedCount: 0,
          status: "empty",
          reason: "no_recent_followed_posts",
          mode: "primary",
        },
      ],
    },
    {
      requestId: "req-2",
      generatedAt: "2026-07-16T11:00:00Z",
      feedName: "your-feed",
      appliedSocialRadius: 2,
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

    element.shadowRoot?.querySelector<HTMLButtonElement>(".breakdown-button")?.click();
    await element.updateComplete;

    expect(changed).not.toHaveBeenCalled();
    expect(element.shadowRoot?.querySelector('[role="dialog"]')?.textContent).toContain("Friends");
    expect(element.shadowRoot?.querySelector('[role="dialog"]')?.textContent).toContain(
      "no_recent_followed_posts",
    );
    element.remove();
  });

  it("keeps only one breakdown open and closes it with Escape", async () => {
    const element = makeTabs();
    await element.updateComplete;
    const buttons = element.shadowRoot?.querySelectorAll<HTMLButtonElement>(".breakdown-button");

    buttons?.[0]?.click();
    await element.updateComplete;
    buttons?.[1]?.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(element.shadowRoot?.querySelector('[role="dialog"]')?.textContent).toContain("Balanced");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector('[role="dialog"]')).toBeNull();
    element.remove();
  });
});
