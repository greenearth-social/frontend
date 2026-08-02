import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rootStore: {
    preferencesStore: {
      values: { socialRadius: 3, freshness: 5, politics: 1, purpose: 0.5 },
      socialRadiusWeights: [
        { name: "followed_users", weight: 0.4 },
        { name: "two_tower", weight: 0.3 },
        { name: "popularity", weight: 0.3 },
      ],
    },
    services: {
      analyticsService: {
        capture: vi.fn<(event: string, properties: Record<string, unknown>) => void>(),
      },
    },
    feedbackStore: {
      mode: "test",
      unavailableReason: null,
      unavailableReasonFor: vi.fn().mockReturnValue(null),
    },
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import { HowItWorksPage } from "../pages/how-it-works-page";

describe("HowItWorks analytics", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    testState.rootStore.services.analyticsService.capture.mockReset();
  });

  it("captures opening a diagram component but not closing it", async () => {
    const element = document.createElement("how-it-works-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const component = element.shadowRoot?.querySelector<HTMLElement>(".config-pill");
    component?.click();
    await element.updateComplete;

    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "howItWorksComponentClicked",
      {
        component_id: "time_window",
        component_label: "Time window",
        component_type: "config",
        feed_name: "your-feed",
        feed_label: "GreenEarth",
      },
    );

    component?.click();
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledOnce();
  });

  it("captures every supported diagram component ID", async () => {
    const element = document.createElement("how-it-works-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const components = [
      element.shadowRoot?.querySelector<HTMLElement>(".config-pill"),
      ...Array.from(element.shadowRoot?.querySelectorAll<HTMLElement>(".node-box-source") ?? []),
      ...Array.from(element.shadowRoot?.querySelectorAll<HTMLElement>(".node-box-signal") ?? []),
      element.shadowRoot?.querySelector<HTMLElement>(".engaging-pill"),
      ...Array.from(element.shadowRoot?.querySelectorAll<HTMLElement>(".penalty-pill") ?? []),
    ];
    for (const component of components) component?.click();

    expect(
      testState.rootStore.services.analyticsService.capture.mock.calls.map(
        (call) => call[1].component_id,
      ),
    ).toEqual([
      "time_window",
      "following",
      "authors_topics",
      "popular",
      "predict_like",
      "constructiveness",
      "engaging_constructive",
      "repeated_author",
      "repeated_topic",
    ]);
  });

  it("presents source weights as fixed values while keeping their details clickable", async () => {
    const element = document.createElement("how-it-works-page");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll(".weight-pill")).toHaveLength(3);
    expect(element.shadowRoot?.querySelector(".weight-pill")?.textContent.trim()).toBe("0.40");
    expect(HowItWorksPage.styles.cssText).toContain('content: "Weight "');
    expect(HowItWorksPage.styles.cssText).toContain("font-style: normal");
    expect(HowItWorksPage.styles.cssText).not.toContain("transform: scale(1.08)");

    element.shadowRoot?.querySelector<HTMLElement>(".weight-pill")?.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector(".popup-value")?.textContent).toContain(
      "Weight: 0.40",
    );
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "howItWorksComponentClicked",
      {
        component_id: "following",
        component_label: "Following",
        component_type: "source",
        feed_name: "your-feed",
        feed_label: "GreenEarth",
      },
    );
  });
});
