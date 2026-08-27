import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => {
  const values = {
    sourceWeights: {
      following: 0.3,
      networkLikes: 0.2,
      authorsTopics: 0.25,
      popular: 0.25,
    },
    freshness: 5,
    politics: 1,
    purpose: 0.5,
  };
  return {
    values,
    save: vi.fn().mockResolvedValue(undefined),
    capture: vi.fn(),
    rootStore: {
      preferencesStore: {
        hasLoaded: true,
        valuesFor: vi.fn(() => values),
        load: vi.fn().mockResolvedValue(undefined),
        save: vi.fn(),
        savePatch: vi.fn(),
        restoreDefaults: vi.fn().mockResolvedValue(true),
      },
      services: {
        analyticsService: { capture: vi.fn() },
      },
      feedbackStore: {
        mode: "test",
        unavailableReason: null,
        unavailableReasonFor: vi.fn().mockReturnValue(null),
      },
      settingsPreviewStore: {
        activateFeed: vi.fn().mockResolvedValue(undefined),
        refreshBaselineIfNew: vi.fn().mockResolvedValue({ status: "unchanged" }),
        preview: vi.fn().mockResolvedValue(null),
        acceptPreview: vi.fn(),
        baselineItems: [],
        displayedItems: [],
        displayedFilteringCounts: null,
        isLoadingBaseline: false,
        isRefreshingBaseline: false,
        isGenerating: false,
        error: null as string | null,
        warning: null as string | null,
        baselineRefreshError: null as string | null,
      },
    },
  };
});

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import "../pages/settings-page";
import type { IconRangeSlider } from "../components/icon-range-slider";
import { settingsPageStyles } from "../pages/settings-page.styles";

describe("SettingsPage", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    testState.values.sourceWeights = {
      following: 0.3,
      networkLikes: 0.2,
      authorsTopics: 0.25,
      popular: 0.25,
    };
    testState.values.freshness = 5;
    testState.values.politics = 1;
    testState.values.purpose = 0.5;
    testState.rootStore.preferencesStore.save.mockReset();
    testState.rootStore.preferencesStore.save.mockResolvedValue(undefined);
    testState.rootStore.preferencesStore.savePatch.mockReset();
    testState.rootStore.preferencesStore.savePatch.mockImplementation(
      (_feedName: string, patch: Partial<typeof testState.values>) => {
        Object.assign(testState.values, patch, {
          sourceWeights: patch.sourceWeights
            ? { ...patch.sourceWeights }
            : testState.values.sourceWeights,
        });
        return Promise.resolve(true);
      },
    );
    testState.rootStore.preferencesStore.restoreDefaults.mockReset();
    testState.rootStore.preferencesStore.restoreDefaults.mockResolvedValue(true);
    testState.rootStore.preferencesStore.load.mockReset();
    testState.rootStore.preferencesStore.load.mockResolvedValue(undefined);
    testState.rootStore.preferencesStore.hasLoaded = true;
    testState.rootStore.services.analyticsService.capture.mockReset();
    testState.rootStore.settingsPreviewStore.activateFeed.mockReset();
    testState.rootStore.settingsPreviewStore.activateFeed.mockResolvedValue(undefined);
    testState.rootStore.settingsPreviewStore.refreshBaselineIfNew.mockReset();
    testState.rootStore.settingsPreviewStore.refreshBaselineIfNew.mockResolvedValue({
      status: "unchanged",
    });
    testState.rootStore.settingsPreviewStore.preview.mockReset();
    testState.rootStore.settingsPreviewStore.preview.mockResolvedValue(null);
    testState.rootStore.settingsPreviewStore.acceptPreview.mockReset();
    testState.rootStore.settingsPreviewStore.isLoadingBaseline = false;
    testState.rootStore.settingsPreviewStore.isRefreshingBaseline = false;
    testState.rootStore.settingsPreviewStore.isGenerating = false;
    testState.rootStore.settingsPreviewStore.error = null;
    testState.rootStore.settingsPreviewStore.warning = null;
    testState.rootStore.settingsPreviewStore.baselineRefreshError = null;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders the full GreenEarth pipeline and disabled Politics control", async () => {
    const element = document.createElement("settings-page");
    element.selectedAlgorithm = "your-feed";
    document.body.appendChild(element);
    await element.updateComplete;
    await Promise.resolve();
    await element.updateComplete;

    const sectionTitles = Array.from(
      element.shadowRoot?.querySelectorAll(".section-title") ?? [],
    ).map((title) => title.textContent.trim());
    expect(sectionTitles).toEqual(["Sources", "Ranking", "Diversification"]);
    expect(element.shadowRoot?.querySelector(".politics-card .coming-soon")?.textContent).toContain(
      "Coming Soon",
    );
    expect(
      element.shadowRoot?.querySelector(".section-ranking .ranking-grid > .politics-card"),
    ).not.toBeNull();
    expect(settingsPageStyles.cssText).toMatch(
      /\.politics-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s,
    );
    const politics = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    ).find((slider) => slider.ariaLabel.startsWith("Politics"));
    expect(politics?.disabled).toBe(true);
    expect(politics?.valueText).toBe("1.00 · Neutral");

    const sliders = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    );
    const sources = sliders.filter((slider) => slider.ariaLabel.endsWith(" amount"));
    expect(sources).toHaveLength(4);
    expect(sources.every((slider) => slider.min === 0 && slider.max === 1)).toBe(true);
    expect(
      Array.from(
        element.shadowRoot?.querySelectorAll<HTMLInputElement>(".percentage-input") ?? [],
      ).map((input) => input.value),
    ).toEqual(["30", "20", "25", "25"]);
    expect(element.shadowRoot?.querySelectorAll(".source-lock-btn")).toHaveLength(4);
    const sourceRows = element.shadowRoot?.querySelectorAll(".source-adjustment-row");
    expect(sourceRows).toHaveLength(4);
    for (const row of sourceRows ?? []) {
      expect(Array.from(row.children)[0]?.classList.contains("source-slider-card")).toBe(true);
      expect(Array.from(row.children)[1]?.classList.contains("source-editor")).toBe(true);
      expect(row.querySelector(".source-slider-card .percentage-field")).toBeNull();
    }

    const sourceRank = sliders.find((slider) => slider.ariaLabel === "Source rank");
    expect(sourceRank?.max).toBe(4);
    expect(sourceRank?.icons[0]).toContain("Eggs-slider.png");
    expect(sourceRank?.icons.at(-1)).toContain("butterfly-slider.png");
    expect(sourceRank?.showValue).toBe(false);
    expect(sourceRank?.valueText).toBe("Balanced");
    expect(
      Array.from(element.shadowRoot?.querySelectorAll(".master-end-label") ?? []).map(
        (label) => label.textContent,
      ),
    ).toEqual(["Friends", "All"]);
    expect(element.shadowRoot?.textContent).toContain("Liked by Following");
    expect(element.shadowRoot?.textContent).toContain("Liked Authors/Topics");
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>(".reset-defaults-btn")?.disabled,
    ).toBe(true);
    expect(
      element.shadowRoot?.querySelector(".reset-defaults-btn > svg path")?.getAttribute("d"),
    ).toContain("M320 128C426 128");
    expect(element.shadowRoot?.querySelector(".reset-label")?.textContent).toBe("Defaults");
    expect(element.shadowRoot?.querySelector("h1")?.getAttribute("aria-label")).toBe(
      "MySky Settings",
    );
    const headerActions = element.shadowRoot?.querySelector(".preview-header-actions");
    expect(
      headerActions?.querySelector<HTMLButtonElement>('[aria-label="Refresh current feed"]'),
    ).toBeNull();
    expect(
      Array.from(headerActions?.querySelectorAll("button") ?? []).map((button) => button.id),
    ).toEqual(["color-legend-button"]);
  });

  it("waits for saved preferences instead of briefly showing fallback defaults", async () => {
    let finishLoad: (() => void) | undefined;
    testState.rootStore.preferencesStore.hasLoaded = false;
    testState.rootStore.preferencesStore.load.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = resolve;
        }),
    );
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".saved-settings-loading")?.textContent).toContain(
      "Loading your saved settings",
    );
    expect(element.shadowRoot?.querySelector("icon-range-slider")).toBeNull();

    testState.values.sourceWeights = {
      following: 0.55,
      networkLikes: 0.15,
      authorsTopics: 0.2,
      popular: 0.1,
    };
    testState.values.freshness = 2;
    testState.values.purpose = 0.65;
    testState.rootStore.preferencesStore.hasLoaded = true;
    finishLoad?.();
    await Promise.resolve();
    await element.updateComplete;

    const sliders = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    );
    expect(sliders.find((slider) => slider.ariaLabel === "Following amount")?.value).toBe(0.55);
    expect(sliders.find((slider) => slider.ariaLabel === "Time Window")?.value).toBe(2);
    expect(sliders.find((slider) => slider.ariaLabel === "Constructive weight")?.value).toBe(0.65);
  });

  it("resets the selected feed immediately and records one undoable change", async () => {
    testState.values.sourceWeights = {
      following: 0.7,
      networkLikes: 0.1,
      authorsTopics: 0.1,
      popular: 0.1,
    };
    testState.values.freshness = 2;
    testState.values.purpose = 0.65;
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await Promise.resolve();
    await element.updateComplete;

    const reset = element.shadowRoot?.querySelector<HTMLButtonElement>(".reset-defaults-btn");
    expect(reset?.disabled).toBe(false);
    reset?.click();
    await Promise.resolve();
    await element.updateComplete;

    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenCalledWith(
      "your-feed",
      {
        sourceWeights: {
          following: 0.3,
          networkLikes: 0.2,
          authorsTopics: 0.25,
          popular: 0.25,
        },
        freshness: 5,
        purpose: 0.5,
      },
      { source_weights: "reset_defaults" },
    );
    expect(reset?.disabled).toBe(true);
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>(
        '[aria-label="Undo last settings change"]',
      )?.disabled,
    ).toBe(false);
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>(".mobile-preview-btn")?.disabled,
    ).toBe(false);
  });

  it("shows reset source defaults immediately while persistence is still pending", async () => {
    testState.values.sourceWeights = {
      following: 0.7,
      networkLikes: 0.1,
      authorsTopics: 0.1,
      popular: 0.1,
    };
    let finishReset: ((value: boolean) => void) | undefined;
    testState.rootStore.preferencesStore.savePatch.mockImplementation(
      (_feedName: string, patch: Partial<typeof testState.values>) => {
        Object.assign(testState.values, patch, {
          sourceWeights: patch.sourceWeights ?? testState.values.sourceWeights,
        });
        return new Promise<boolean>((resolve) => {
          finishReset = resolve;
        });
      },
    );
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await Promise.resolve();
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".reset-defaults-btn")?.click();
    await Promise.resolve();
    await element.updateComplete;

    const following = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    ).find((slider) => slider.ariaLabel === "Following amount");
    expect(following?.value).toBe(0.3);
    expect(following?.disabled).toBe(false);

    finishReset?.(true);
    await Promise.resolve();
  });

  it("renders only Time Window and the fixed source pipeline for Random", async () => {
    const element = document.createElement("settings-page");
    element.selectedAlgorithm = "random";
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".section-ranking")).toBeNull();
    expect(element.shadowRoot?.querySelector(".section-diversification")).toBeNull();
    expect(element.shadowRoot?.querySelector(".politics-card")).toBeNull();
    expect(element.shadowRoot?.textContent).toContain("Random");
    expect(element.shadowRoot?.textContent).not.toContain("Fixed source");
    expect(element.shadowRoot?.querySelector("h1")?.getAttribute("aria-label")).toBe(
      "Random Settings",
    );
    expect(element.shadowRoot?.querySelector(".page-title-full")?.textContent).toBe(
      "Random Settings",
    );
  });

  it("omits a weight from fixed Following details", async () => {
    const element = document.createElement("settings-page");
    element.selectedAlgorithm = "best-of-friends";
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector("h1")?.getAttribute("aria-label")).toBe(
      "Best of Friends Settings",
    );

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Learn more about Following"]')
      ?.click();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".popup-card .popup-values")).toBeNull();
    expect(element.shadowRoot?.querySelector(".popup-description")?.textContent).toBe(
      "Posts from accounts you follow.",
    );
  });

  it("links Constructive details to the long-form explanation", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await Promise.resolve();
    await element.updateComplete;

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Learn more about Constructive"]')
      ?.click();
    await element.updateComplete;

    const link = element.shadowRoot?.querySelector<HTMLAnchorElement>(".popup-more");
    expect(link?.textContent).toContain("More");
    expect(link?.href).toBe("https://www.greenearth.social/p/what-does-constructive-mean");
    expect(link?.target).toBe("_blank");
    const row = element.shadowRoot?.querySelector(".popup-detail-row");
    expect(row?.querySelector(".popup-metric-value")?.textContent).toBe("0.50");
    expect(row?.lastElementChild).toBe(link);
  });

  it("previews and atomically commits a source-weight edit", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const following = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    ).find((slider) => slider.ariaLabel === "Following amount");
    expect(following).toBeDefined();

    following?.dispatchEvent(
      new CustomEvent("slider-preview", {
        bubbles: true,
        composed: true,
        detail: { value: 0.53 },
      }),
    );
    await element.updateComplete;
    following?.dispatchEvent(
      new CustomEvent("slider-preview", {
        bubbles: true,
        composed: true,
        detail: { value: 0.6 },
      }),
    );
    await element.updateComplete;
    expect(following?.valueText).toBe("60%");
    following?.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: 0.6 },
      }),
    );

    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenCalledWith(
      "your-feed",
      {
        sourceWeights: {
          following: 0.6,
          networkLikes: 0.12,
          authorsTopics: 0.14,
          popular: 0.14,
        },
      },
      { source_weights: "following" },
    );
  });

  it("commits Following at zero from its individual slider", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const following = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    ).find((slider) => slider.ariaLabel === "Following amount");
    following?.dispatchEvent(
      new CustomEvent("slider-preview", {
        bubbles: true,
        composed: true,
        detail: { value: 0 },
      }),
    );
    await element.updateComplete;
    following?.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: 0 },
      }),
    );

    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenCalledWith(
      "your-feed",
      {
        sourceWeights: {
          following: 0,
          networkLikes: 0.28,
          authorsTopics: 0.36,
          popular: 0.36,
        },
      },
      { source_weights: "following" },
    );
  });

  it("edits whole percentages while preserving locked sources", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const networkLock = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-label="Lock Liked by Following weight"]',
    );
    networkLock?.click();
    await element.updateComplete;
    expect(networkLock?.getAttribute("aria-pressed")).toBe("true");
    const slidersAfterLock = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    );
    expect(
      slidersAfterLock.find((slider) => slider.ariaLabel === "Liked by Following amount")?.disabled,
    ).toBe(true);
    expect(slidersAfterLock.find((slider) => slider.ariaLabel === "Source rank")?.disabled).toBe(
      true,
    );
    const cappedFollowing = slidersAfterLock.find(
      (slider) => slider.ariaLabel === "Following amount",
    );
    expect(cappedFollowing?.max).toBe(0.8);
    expect(cappedFollowing?.scaleMin).toBe(0);
    expect(cappedFollowing?.scaleMax).toBe(1);
    expect(element.shadowRoot?.querySelector(".master-lock-note")?.textContent).toContain(
      "Unlock all",
    );

    const followingInput = element.shadowRoot?.querySelector<HTMLInputElement>(
      '[aria-label="Following percentage"]',
    );
    expect(followingInput).toBeDefined();
    if (followingInput) {
      followingInput.value = "40";
      followingInput.dispatchEvent(new Event("input", { bubbles: true }));
      followingInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenCalledWith(
      "your-feed",
      {
        sourceWeights: {
          following: 0.4,
          networkLikes: 0.2,
          authorsTopics: 0.2,
          popular: 0.2,
        },
      },
      { source_weights: "following" },
    );

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Lock Liked Authors/Topics weight"]')
      ?.click();
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Lock Popular weight"]')
      ?.click();
    await element.updateComplete;
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Lock Following weight"]')
        ?.disabled,
    ).toBe(true);
    const derivedFollowing = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    ).find((slider) => slider.ariaLabel === "Following amount");
    expect(derivedFollowing?.disabled).toBe(true);
    expect(derivedFollowing?.min).toBe(0);
    expect(derivedFollowing?.max).toBe(1);
    expect(derivedFollowing?.value).toBe(0.4);
    const derivedInput = element.shadowRoot?.querySelector<HTMLInputElement>(
      '[aria-label="Following percentage"]',
    );
    expect(derivedInput?.disabled).toBe(true);
    expect(derivedInput?.value).toBe("40");
    expect(derivedInput?.closest(".source-editor")?.classList.contains("is-derived")).toBe(true);

    derivedFollowing?.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: 0.9 },
      }),
    );
    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenCalledTimes(1);

    expect(
      element.shadowRoot
        ?.querySelector('[aria-label="Unlock Liked by Following weight"] svg path')
        ?.getAttribute("d"),
    ).toContain("M256 160L256 224");
    expect(
      element.shadowRoot
        ?.querySelector('[aria-label="Lock Following weight"] svg path')
        ?.getAttribute("d"),
    ).toContain("M416 160C416 124.7");
  });

  it("rejects fractional and out-of-range source percentages", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const input = element.shadowRoot?.querySelector<HTMLInputElement>(
      '[aria-label="Following percentage"]',
    );
    expect(input).toBeDefined();
    if (!input) return;

    expect(input.required).toBe(true);
    expect(input.step).toBe("1");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");

    for (const invalidValue of ["12.5", "101", "-1", ""]) {
      input.value = invalidValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      expect(input.getAttribute("aria-invalid")).toBe("true");
    }
    expect(testState.rootStore.preferencesStore.savePatch).not.toHaveBeenCalled();

    input.value = "40";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenCalledTimes(1);
  });

  it("persists Ranking controls immediately and enables Preview", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;
    const sliders = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    );

    sliders
      .find((slider) => slider.ariaLabel === "Constructive weight")
      ?.dispatchEvent(
        new CustomEvent("slider-change", {
          bubbles: true,
          composed: true,
          detail: { value: 0.65 },
        }),
      );
    await Promise.resolve();
    await element.updateComplete;

    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenCalledWith(
      "your-feed",
      { purpose: 0.65 },
      {},
    );
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>(".mobile-preview-btn")?.disabled,
    ).toBe(false);
    expect(element.shadowRoot?.querySelector(".refresh-popup")).toBeNull();
  });

  it("uses a labeled bordered history control and Back with a mobile Preview title", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const settingsHistory = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".settings-header-actions .history-btn",
    );
    expect(settingsHistory?.textContent.trim()).toBe("Undo");
    expect(settingsHistory?.querySelector("wa-icon")?.getAttribute("name")).toBe("undo");
    expect(settingsPageStyles.cssText).toMatch(
      /\.history-btn\s*\{[^}]*background:\s*transparent/s,
    );
    expect(settingsPageStyles.cssText).toMatch(
      /\.history-btn\s*\{[^}]*border-color:\s*var\(--bluesky-border\)/s,
    );

    const mobileActions = element.shadowRoot?.querySelector(".preview-mobile-primary-actions");
    expect(Array.from(mobileActions?.children ?? []).map((child) => child.className)).toEqual([
      "preview-close",
      "mobile-preview-title",
    ]);
    const back = mobileActions?.firstElementChild as HTMLButtonElement | null;
    expect(back?.getAttribute("aria-label")).toBe("Back to settings");
    expect(back?.textContent.trim()).toBe("");
    expect(back?.querySelector("wa-icon")?.getAttribute("name")).toBe("chevron-left");
    expect(mobileActions?.querySelector(".mobile-preview-title")?.textContent).toBe("Preview");
  });

  it("keeps Preview available during baseline loading and background refresh", async () => {
    testState.rootStore.settingsPreviewStore.isLoadingBaseline = true;
    testState.rootStore.settingsPreviewStore.isRefreshingBaseline = true;
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const freshness = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    ).find((slider) => slider.ariaLabel === "Time Window");
    freshness?.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: 2 },
      }),
    );
    await Promise.resolve();
    await element.updateComplete;

    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>(".mobile-preview-btn")?.disabled,
    ).toBe(false);
  });

  it("reports baseline sync errors without a manual Retry control", async () => {
    testState.rootStore.settingsPreviewStore.baselineRefreshError = "offline";
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const error = element.shadowRoot?.querySelector(".baseline-refresh-error");
    expect(error?.textContent).toContain("check again when you return");
    expect(error?.querySelector("button")).toBeNull();
  });

  it("coalesces lifecycle syncs without starting a repeating timer", async () => {
    vi.useFakeTimers();
    const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    try {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      const element = document.createElement("settings-page");
      document.body.appendChild(element);
      await element.updateComplete;
      await Promise.resolve();
      await Promise.resolve();

      const refresh = testState.rootStore.settingsPreviewStore.refreshBaselineIfNew;
      expect(refresh).not.toHaveBeenCalled();

      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(refresh).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      const hiddenCalls = refresh.mock.calls.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(refresh).toHaveBeenCalledTimes(hiddenCalls);

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(hiddenCalls + 1);
    } finally {
      document.body.replaceChildren();
      if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
      vi.useRealTimers();
    }
  });

  it("runs one trailing lifecycle sync when an event arrives in flight", async () => {
    vi.useFakeTimers();
    const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    let finishFirst: ((value: { status: "unchanged" }) => void) | undefined;
    try {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      testState.rootStore.settingsPreviewStore.refreshBaselineIfNew
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishFirst = resolve;
            }),
        )
        .mockResolvedValue({ status: "unchanged" });
      const element = document.createElement("settings-page");
      document.body.appendChild(element);
      await element.updateComplete;

      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
      expect(testState.rootStore.settingsPreviewStore.refreshBaselineIfNew).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new PageTransitionEvent("pageshow"));
      await vi.advanceTimersByTimeAsync(0);
      expect(testState.rootStore.settingsPreviewStore.refreshBaselineIfNew).toHaveBeenCalledTimes(1);

      finishFirst?.({ status: "unchanged" });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(testState.rootStore.settingsPreviewStore.refreshBaselineIfNew).toHaveBeenCalledTimes(2);
    } finally {
      document.body.replaceChildren();
      if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
      vi.useRealTimers();
    }
  });

  it("rolls back history when Defaults cannot be saved", async () => {
    testState.values.freshness = 2;
    testState.rootStore.preferencesStore.savePatch.mockResolvedValue(false);
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await Promise.resolve();
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".reset-defaults-btn")?.click();
    await Promise.resolve();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".settings-error")?.textContent).toContain(
      "Settings could not be updated",
    );
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>(
        '[aria-label="Undo last settings change"]',
      )?.disabled,
    ).toBe(true);
  });

  it("restores the previous Undo entry when a newer edit fails", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const sliders = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    );
    sliders
      .find((slider) => slider.ariaLabel === "Time Window")
      ?.dispatchEvent(
        new CustomEvent("slider-change", {
          bubbles: true,
          composed: true,
          detail: { value: 2 },
        }),
      );
    await Promise.resolve();
    await element.updateComplete;

    testState.rootStore.preferencesStore.savePatch.mockResolvedValueOnce(false);
    sliders
      .find((slider) => slider.ariaLabel === "Constructive weight")
      ?.dispatchEvent(
        new CustomEvent("slider-change", {
          bubbles: true,
          composed: true,
          detail: { value: 0.65 },
        }),
      );
    await Promise.resolve();
    await element.updateComplete;

    const undo = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-label="Undo last settings change"]',
    );
    expect(undo?.disabled).toBe(false);
    undo?.click();
    await Promise.resolve();
    await element.updateComplete;
    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenLastCalledWith(
      "your-feed",
      { freshness: 5 },
      {},
    );
  });

  it("uses question icons and removes the combined Ranking explanation button", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll(".component-title .question-icon").length).toBe(8);
    expect(element.shadowRoot?.textContent).not.toContain("Engaging vs. Constructive");
    expect(element.shadowRoot?.querySelector(".master-label")).toBeNull();
  });

  it("opens Liked by Following details with its current weight", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Learn more about Liked by Following"]')
      ?.click();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('[role="dialog"]')?.textContent).toContain(
      "liked by accounts you follow",
    );
    expect(element.shadowRoot?.querySelector(".popup-metric-value")?.textContent).toBe("0.20");
  });

  it("toggles one-level Undo and Redo after an immediate change", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    const freshness = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    ).find((slider) => slider.ariaLabel === "Time Window");
    freshness?.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: 2 },
      }),
    );
    await Promise.resolve();
    await element.updateComplete;

    const undo = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-label="Undo last settings change"]',
    );
    expect(undo?.disabled).toBe(false);
    undo?.click();
    await Promise.resolve();
    await element.updateComplete;

    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenNthCalledWith(
      2,
      "your-feed",
      { freshness: 5 },
      {},
    );
    const redo = element.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-label="Redo last settings change"]',
    );
    expect(redo?.disabled).toBe(false);
    redo?.click();
    await Promise.resolve();
    await element.updateComplete;

    expect(testState.rootStore.preferencesStore.savePatch).toHaveBeenNthCalledWith(
      3,
      "your-feed",
      { freshness: 2 },
      {},
    );
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>(
        '[aria-label="Undo last settings change"]',
      )?.disabled,
    ).toBe(false);
    expect(element.shadowRoot?.querySelector(".save-changes-btn, .discard-changes-btn")).toBeNull();
  });

  it("keeps explanations clickable independently from controls", async () => {
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Learn more about Popular"]')
      ?.click();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('[role="dialog"]')?.textContent).toContain(
      "Trending posts",
    );
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "howItWorksComponentClicked",
      expect.objectContaining({ component_id: "popular", feed_name: "your-feed" }),
    );
  });
});
