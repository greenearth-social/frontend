import { afterEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rootStore: null as {
    preferencesStore: {
      values: {
        socialRadius: number;
        freshness: number;
        politics: number;
        purpose: number;
      };
      load: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
    };
    services: { analyticsService: { capture: ReturnType<typeof vi.fn> } };
    feedbackStore: {
      mode: "test";
      unavailableReason: null;
      unavailableReasonFor: ReturnType<typeof vi.fn>;
    };
  } | null,
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import { ControlsPage } from "../pages/controls-page";

describe("ControlsPage", () => {
  afterEach(() => {
    testState.rootStore = null;
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  describe("algorithm-specific sliders", () => {
    it("shows Social Radius only for your-feed", async () => {
      const el = document.createElement("controls-page");
      el.selectedAlgorithm = "your-feed";
      document.body.appendChild(el);
      await el.updateComplete;

      const titles = Array.from(el.shadowRoot?.querySelectorAll(".slider-title span:first-child") ?? [])
        .map((node) => node.textContent.trim());
      expect(titles).toContain("Social Radius");
    });

    it("hides Social Radius for best-of-friends", async () => {
      const el = document.createElement("controls-page");
      el.selectedAlgorithm = "best-of-friends";
      document.body.appendChild(el);
      await el.updateComplete;

      const titles = Array.from(el.shadowRoot?.querySelectorAll(".slider-title span:first-child") ?? [])
        .map((node) => node.textContent.trim());
      expect(titles).not.toContain("Social Radius");
      expect(titles).toContain("Freshness");
    });

    it("shows only Freshness for random", async () => {
      const el = document.createElement("controls-page");
      el.selectedAlgorithm = "random";
      document.body.appendChild(el);
      await el.updateComplete;

      const titles = Array.from(el.shadowRoot?.querySelectorAll(".slider-title span:first-child") ?? [])
        .map((node) => node.textContent.trim());
      expect(titles).toEqual(["Freshness"]);
    });
  });

  it("enables freshness while keeping future weighted controls disabled", async () => {
    const el = document.createElement("controls-page");
    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;

    const sliders = el.shadowRoot?.querySelectorAll("lifecycle-slider");
    expect(sliders).toHaveLength(3);
    expect(sliders?.[0]?.disabled).toBe(false);
    expect(sliders?.[1]?.disabled).toBe(true);
    expect(sliders?.[2]?.disabled).toBe(true);
    const freshness = el.shadowRoot?.querySelector("discrete-slider");
    expect(freshness?.disabled).toBe(false);
    expect(freshness?.options).toEqual(["6h", "12h", "24h", "48h", "72h", "7d"]);
    expect(freshness?.iconSources).toEqual([
      "/assets/freshness_slider/6hr.png",
      "/assets/freshness_slider/12hr.png",
      "/assets/freshness_slider/24hr.png",
      "/assets/freshness_slider/2d.png",
      "/assets/freshness_slider/3d.png",
      "/assets/freshness_slider/7d.png",
    ]);
    expect(freshness?.shadowRoot?.querySelectorAll(".step-icon-image")).toHaveLength(6);
    expect(freshness?.shadowRoot?.querySelector(".step-btn.active img")?.getAttribute("src")).toBe(
      "/assets/freshness_slider/7d.png",
    );
    expect(el.shadowRoot?.textContent).not.toContain("FreshnessComing Soon");
    el.remove();
  });

  it("renders accessible help buttons for all controls and opens disabled help", async () => {
    const capture = vi.fn();
    testState.rootStore = {
      preferencesStore: {
        values: { socialRadius: 3, freshness: 5, politics: 1, purpose: 0.5 },
        load: vi.fn().mockResolvedValue(undefined),
        save: vi.fn().mockResolvedValue(undefined),
      },
      services: { analyticsService: { capture } },
      feedbackStore: {
        mode: "test",
        unavailableReason: null,
        unavailableReasonFor: vi.fn().mockReturnValue(null),
      },
    };
    const el = document.createElement("controls-page");
    document.body.appendChild(el);
    await el.updateComplete;

    const buttons = el.shadowRoot?.querySelectorAll<HTMLButtonElement>(".help-button");
    expect(buttons).toHaveLength(4);
    expect(Array.from(buttons ?? []).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Explain Social Radius",
      "Explain Freshness",
      "Explain Politics",
      "Explain Purpose",
    ]);

    buttons?.[2]?.click();
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[role="dialog"]')?.textContent).toContain(
      "1.00 is neutral",
    );
    expect(capture).toHaveBeenCalledWith("controlHelpOpened", {
      control_name: "politics",
    });
    el.remove();
  });

  it("italicizes coming-soon labels", () => {
    expect(getComputedStyle(document.createElement("span")).fontStyle).toBeDefined();
    expect(ControlsPage.styles.cssText).toContain("font-style: italic");
  });

  it("shows both active controls' refresh notice in one top-center location", async () => {
    vi.useFakeTimers();
    const el = document.createElement("controls-page");
    document.body.appendChild(el);
    await el.updateComplete;
    await vi.runAllTimersAsync();
    await el.updateComplete;

    const freshness = el.shadowRoot?.querySelector("discrete-slider");
    freshness?.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: 2 },
      }),
    );
    await el.updateComplete;

    expect(el.shadowRoot?.querySelectorAll(".refresh-popup")).toHaveLength(1);
    expect(el.shadowRoot?.querySelector(".refresh-popup-message")?.textContent).toContain(
      "Refresh your BlueSky Feed to see updates!",
    );
    expect(ControlsPage.styles.cssText).toMatch(
      /\.refresh-popup\s*\{[^}]*top: 0\.25rem[^}]*left: 50%/s,
    );
    el.remove();
  });
});
