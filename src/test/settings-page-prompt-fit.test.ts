import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPreferences, FeedPreferencesByFeed, LlmPrompt } from "../services/types";
import type { RootStore } from "../stores/root-store";
import { PreferencesStore } from "../stores/preferences-store";
import { SettingsPreviewStore } from "../stores/settings-preview-store";

// These tests run the settings page against the real stores, so they prove the
// page reacts to a finished fit on its own.
const testState = vi.hoisted((): { root: unknown } => ({ root: null }));

vi.mock("../main", () => ({
  getRootStore: () => testState.root,
}));

import "../pages/settings-page";

const saved: FeedPreferencesByFeed = {
  "your-feed": {
    sourceWeights: {
      following: 0.3,
      networkLikes: 0.2,
      authorsTopics: 0.25,
      popular: 0.25,
      llm: 0,
    },
    freshness: 5,
    politics: 1,
    purpose: 0.5,
  },
  "best-of-friends": { freshness: 3, purpose: 0.65, politics: 1 },
  random: { freshness: 1 },
};

const emptyPreview = {
  requestId: "preview-1",
  generatedAt: "2026-09-30T10:00:00Z",
  apiReleaseSha: null,
  items: [],
  filteringCounts: {
    storedItemCount: 0,
    displayedItemCount: 0,
    publiclyFilteredCount: 0,
    unavailableCount: 0,
    partialItemCount: 0,
  },
  generatorDiagnostics: [],
};

async function makeRoot() {
  let finishFit!: () => void;
  const patchPreferences = vi.fn((_feedName: string, values: FeedPreferences) =>
    Promise.resolve(values),
  );
  const fitLlmPrompt = vi.fn(
    (prompt: string) =>
      new Promise<LlmPrompt>((resolve) => {
        finishFit = () => {
          resolve({ promptKey: "v1", prompt, createdAt: "2026-09-30T10:00:00Z" });
        };
      }),
  );
  const root = {
    services: {
      feedApiService: {
        getPreferences: vi.fn().mockResolvedValue(saved),
        getLlmPrompt: vi.fn().mockResolvedValue({ enabled: true, prompt: null }),
        patchPreferences,
        fitLlmPrompt,
        listFeeds: vi.fn().mockResolvedValue({ feeds: [] }),
        createFeedPreview: vi.fn().mockResolvedValue({
          requestId: "preview-1",
          feedName: "your-feed",
          generatedAt: "2026-09-30T10:00:00Z",
          expiresAt: "2026-09-30T10:10:00Z",
        }),
        getFeedPreview: vi.fn().mockResolvedValue(emptyPreview),
      },
      analyticsService: { capture: vi.fn() },
    },
    feedbackStore: {
      mode: "test",
      unavailableReason: null,
      unavailableReasonFor: vi.fn().mockReturnValue(null),
    },
  } as unknown as RootStore;
  root.preferencesStore = new PreferencesStore(root);
  root.settingsPreviewStore = new SettingsPreviewStore(root);
  testState.root = root;
  await root.preferencesStore.load();
  return {
    root,
    patchPreferences,
    finishFit: () => {
      finishFit();
    },
  };
}

async function openSettings() {
  const page = document.createElement("settings-page");
  document.body.appendChild(page);
  await page.updateComplete;
  return page;
}

async function sendPrompt(page: HTMLElementTagNameMap["settings-page"], text: string) {
  const input = page.shadowRoot?.querySelector<HTMLTextAreaElement>(".prompt-input");
  if (!input) throw new Error("Expected prompt input");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  await page.updateComplete;
  page.shadowRoot?.querySelector<HTMLButtonElement>(".prompt-send-btn")?.click();
  await page.updateComplete;
}

async function settle(page: HTMLElementTagNameMap["settings-page"]) {
  for (let turn = 0; turn < 5; turn++) {
    await Promise.resolve();
    await page.updateComplete;
  }
}

const promptShare = {
  sourceWeights: {
    following: 0.24,
    networkLikes: 0.16,
    authorsTopics: 0.2,
    popular: 0.2,
    llm: 0.2,
  },
};

describe("SettingsPage prompt fit with the real stores", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("gives the prompt its share on a page reopened while the fit was running", async () => {
    const { patchPreferences, finishFit } = await makeRoot();
    const closed = await openSettings();
    await sendPrompt(closed, "hopeful science");
    closed.remove();

    const reopened = await openSettings();
    const send = reopened.shadowRoot?.querySelector<HTMLButtonElement>(".prompt-send-btn");
    expect(send?.textContent).toContain("Fitting…");
    expect(send?.disabled).toBe(true);

    finishFit();
    await settle(reopened);

    expect(patchPreferences).toHaveBeenCalledTimes(1);
    expect(patchPreferences).toHaveBeenCalledWith("your-feed", promptShare);
    expect(reopened.shadowRoot?.querySelector(".prompt-send-btn")?.textContent).toContain("Send");
    expect(reopened.shadowRoot?.querySelector<HTMLButtonElement>("#update-preview")?.disabled).toBe(
      false,
    );
  });

  it("gives the prompt its share only once the user is back on Your Feed", async () => {
    const { patchPreferences, finishFit } = await makeRoot();
    const page = await openSettings();
    await sendPrompt(page, "hopeful science");

    page.selectedAlgorithm = "best-of-friends";
    await page.updateComplete;
    finishFit();
    await settle(page);
    expect(patchPreferences).not.toHaveBeenCalled();

    page.selectedAlgorithm = "your-feed";
    await settle(page);

    expect(patchPreferences).toHaveBeenCalledTimes(1);
    expect(patchPreferences).toHaveBeenCalledWith("your-feed", promptShare);
    expect(page.shadowRoot?.querySelector<HTMLButtonElement>("#update-preview")?.disabled).toBe(
      false,
    );
  });
});
