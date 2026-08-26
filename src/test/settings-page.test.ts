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
    testState.rootStore.preferencesStore.restoreDefaults.mockReset();
    testState.rootStore.preferencesStore.restoreDefaults.mockResolvedValue(true);
    testState.rootStore.preferencesStore.load.mockReset();
    testState.rootStore.preferencesStore.load.mockResolvedValue(undefined);
    testState.rootStore.preferencesStore.hasLoaded = true;
    testState.rootStore.services.analyticsService.capture.mockReset();
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
    expect(element.shadowRoot?.querySelector(".reset-label-short")?.textContent).toBe("Defaults");
    const headerActions = element.shadowRoot?.querySelector(".preview-header-actions");
    expect(
      headerActions?.querySelector<HTMLButtonElement>('[aria-label="Refresh current feed"]'),
    ).not.toBeNull();
    expect(
      Array.from(headerActions?.querySelectorAll("button") ?? []).map((button) => button.id),
    ).toEqual(["current-feed-refresh", "color-legend-button", ""]);
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

  it("resets the selected feed and shows the refresh notice", async () => {
    vi.useFakeTimers();
    testState.values.sourceWeights = {
      following: 0.7,
      networkLikes: 0.1,
      authorsTopics: 0.1,
      popular: 0.1,
    };
    testState.values.freshness = 2;
    testState.values.purpose = 0.65;
    testState.rootStore.preferencesStore.restoreDefaults.mockImplementation(() => {
      testState.values.sourceWeights = {
        following: 0.3,
        networkLikes: 0.2,
        authorsTopics: 0.25,
        popular: 0.25,
      };
      testState.values.freshness = 5;
      testState.values.purpose = 0.5;
      return Promise.resolve(true);
    });
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

    expect(testState.rootStore.preferencesStore.restoreDefaults).toHaveBeenCalledWith("your-feed");
    expect(reset?.disabled).toBe(true);
    expect(element.shadowRoot?.querySelector(".refresh-popup")?.textContent).toContain(
      "Refresh your Bluesky feed",
    );
    vi.useRealTimers();
  });

  it("shows reset source defaults immediately while persistence is still pending", async () => {
    vi.useFakeTimers();
    testState.values.sourceWeights = {
      following: 0.7,
      networkLikes: 0.1,
      authorsTopics: 0.1,
      popular: 0.1,
    };
    let finishReset: ((value: boolean) => void) | undefined;
    testState.rootStore.preferencesStore.restoreDefaults.mockImplementation(() => {
      testState.values.sourceWeights = {
        following: 0.3,
        networkLikes: 0.2,
        authorsTopics: 0.25,
        popular: 0.25,
      };
      return new Promise<boolean>((resolve) => {
        finishReset = resolve;
      });
    });
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
    expect(element.shadowRoot?.querySelector(".refresh-popup")?.textContent).toContain(
      "Refresh your Bluesky feed",
    );

    finishReset?.(true);
    await Promise.resolve();
    vi.useRealTimers();
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
  });

  it("omits a weight from fixed Following details", async () => {
    const element = document.createElement("settings-page");
    element.selectedAlgorithm = "best-of-friends";
    document.body.appendChild(element);
    await element.updateComplete;

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

    expect(testState.rootStore.preferencesStore.save).toHaveBeenCalledWith(
      "your-feed",
      "source_weights",
      { following: 0.6, networkLikes: 0.12, authorsTopics: 0.14, popular: 0.14 },
      "following",
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

    expect(testState.rootStore.preferencesStore.save).toHaveBeenCalledWith(
      "your-feed",
      "source_weights",
      { following: 0, networkLikes: 0.28, authorsTopics: 0.36, popular: 0.36 },
      "following",
    );
  });

  it("edits whole percentages while preserving locked sources", async () => {
    testState.rootStore.preferencesStore.save.mockImplementation(
      (_feedName, control: string, value: unknown) => {
        if (control === "source_weights") {
          testState.values.sourceWeights = value as typeof testState.values.sourceWeights;
        }
        return Promise.resolve();
      },
    );
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

    expect(testState.rootStore.preferencesStore.save).toHaveBeenCalledWith(
      "your-feed",
      "source_weights",
      { following: 0.4, networkLikes: 0.2, authorsTopics: 0.2, popular: 0.2 },
      "following",
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
    expect(testState.rootStore.preferencesStore.save).toHaveBeenCalledTimes(1);

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
    expect(testState.rootStore.preferencesStore.save).not.toHaveBeenCalled();

    input.value = "40";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(testState.rootStore.preferencesStore.save).toHaveBeenCalledTimes(1);
  });

  it("shows the persistent refresh notice for both Ranking controls", async () => {
    vi.useFakeTimers();
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;
    const sliders = Array.from(
      element.shadowRoot?.querySelectorAll<IconRangeSlider>("icon-range-slider") ?? [],
    );

    for (const ariaLabel of ["Engaging weight", "Constructive weight"]) {
      sliders
        .find((slider) => slider.ariaLabel === ariaLabel)
        ?.dispatchEvent(
          new CustomEvent("slider-change", {
            bubbles: true,
            composed: true,
            detail: { value: 0.65 },
          }),
        );
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(".refresh-popup")?.textContent).toContain(
        "Refresh your Bluesky feed",
      );
    }

    vi.advanceTimersByTime(3000);
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector(".refresh-popup")).toBeNull();
    vi.useRealTimers();
  });

  it("shows a clear message when Reset Defaults cannot be saved", async () => {
    vi.useFakeTimers();
    testState.values.freshness = 2;
    testState.rootStore.preferencesStore.restoreDefaults.mockResolvedValue(false);
    const element = document.createElement("settings-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await Promise.resolve();
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".reset-defaults-btn")?.click();
    await Promise.resolve();
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".refresh-popup")?.textContent).toContain(
      "Couldn't reset settings",
    );
    vi.useRealTimers();
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

  it("renders refresh popup as a link to blueskyUrl when provided", async () => {
    vi.useFakeTimers();
    const element = document.createElement("settings-page");
    element.blueskyUrl = "https://bsky.app/profile/greenearth-social.bsky.social/feed/your-feed";
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
    await element.updateComplete;

    const link = element.shadowRoot?.querySelector<HTMLAnchorElement>(".refresh-popup");
    expect(link?.tagName.toLowerCase()).toBe("a");
    expect(link?.href).toBe(
      "https://bsky.app/profile/greenearth-social.bsky.social/feed/your-feed",
    );
    expect(link?.target).toBe("_blank");
    vi.useRealTimers();
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
