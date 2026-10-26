import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPreferences, FeedPreferencesByFeed, LlmPrompt } from "../services/types";
import { FeedApiError } from "../services/types";
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

async function makeRoot(activePrompt: LlmPrompt | null = null) {
  let finishRemoval!: () => void;
  let failRemoval!: (error: unknown) => void;
  const removeLlmPrompt = vi.fn(
    () =>
      new Promise<FeedPreferences>((resolve, reject) => {
        finishRemoval = () => {
          resolve(structuredClone(saved["your-feed"] ?? {}));
        };
        failRemoval = reject;
      }),
  );
  let failFit!: (error: unknown) => void;
  let finishFit!: () => void;
  const patchPreferences = vi.fn((_feedName: string, values: FeedPreferences) =>
    Promise.resolve(values),
  );
  const fitLlmPrompt = vi.fn(
    (prompt: string) =>
      new Promise<LlmPrompt>((resolve, reject) => {
        failFit = reject;
        finishFit = () => {
          resolve({ promptKey: "v1", prompt, createdAt: "2026-09-30T10:00:00Z" });
        };
      }),
  );
  const root = {
    services: {
      feedApiService: {
        getPreferences: vi.fn().mockResolvedValue(saved),
        getLlmPrompt: vi.fn().mockResolvedValue({ enabled: true, prompt: activePrompt }),
        patchPreferences,
        fitLlmPrompt,
        removeLlmPrompt,
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
    fitLlmPrompt,
    removeLlmPrompt,
    finishRemoval: () => {
      finishRemoval();
    },
    failRemoval: (error: unknown) => {
      failRemoval(error);
    },
    failFit: (error: unknown) => {
      failFit(error);
    },
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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives the prompt its share on a page reopened while the fit was running", async () => {
    const { patchPreferences, finishFit } = await makeRoot();
    const closed = await openSettings();
    await sendPrompt(closed, "hopeful science");
    closed.remove();

    const reopened = await openSettings();
    const send = reopened.shadowRoot?.querySelector<HTMLButtonElement>(".prompt-send-btn");
    expect(send?.textContent).toContain("Thinking…");
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

  it("shows the active prompt above an empty input and replaces it only on success", async () => {
    const { root, finishFit, fitLlmPrompt } = await makeRoot({
      promptKey: "old",
      prompt: "old prompt",
      createdAt: "2026-09-17T10:00:00Z",
    });
    const page = await openSettings();
    const input = page.shadowRoot?.querySelector<HTMLTextAreaElement>(".prompt-input");
    expect(input?.value).toBe("");
    expect(page.shadowRoot?.querySelector(".active-prompt-text")?.textContent).toBe("old prompt");
    await sendPrompt(page, "new prompt");
    expect(page.shadowRoot?.querySelector(".prompt-card.thinking")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(input?.disabled).toBe(true);
    expect(page.shadowRoot?.querySelector(".active-prompt-text")?.textContent).toBe("old prompt");
    page.shadowRoot?.querySelector<HTMLButtonElement>(".prompt-send-btn")?.click();
    expect(fitLlmPrompt).toHaveBeenCalledTimes(1);
    finishFit();
    await settle(page);
    expect(input?.value).toBe("");
    expect(input?.disabled).toBe(false);
    expect(page.shadowRoot?.querySelector(".active-prompt-text")?.textContent).toBe("new prompt");
    expect(page.shadowRoot?.querySelector(".prompt-card.thinking")).toBeNull();
    expect(root.preferencesStore.llmPrompt?.prompt).toBe("new prompt");
  });

  it.each([
    [new Error("private diagnostics"), "Something went wrong"],
    [
      new FeedApiError(422, "private diagnostics", {
        detail: { code: "llm_query_vector_pool_too_small" },
      }),
      "broader topic",
    ],
    [
      new FeedApiError(422, "private diagnostics", {
        detail: { code: "llm_query_vector_prompt_not_accepted" },
      }),
      "Prompt not accepted",
    ],
    [
      new FeedApiError(429, "private diagnostics", {
        detail: { scopes: ["user"], retry_after_seconds: 120 },
      }),
      "past six hours",
    ],
  ])(
    "shows a toast and preserves the prompt, draft and weights on failure: %s",
    async (error, wording) => {
      const { root, failFit, patchPreferences } = await makeRoot({
        promptKey: "old",
        prompt: "old prompt",
        createdAt: "2026-09-17T10:00:00Z",
      });
      const page = await openSettings();
      await sendPrompt(page, "new prompt");
      failFit(error);
      await settle(page);
      const toast = page.shadowRoot?.querySelector(".prompt-toast");
      expect(toast?.textContent).toContain(wording);
      expect(toast?.textContent).not.toContain("private diagnostics");
      expect(toast?.closest(".prompt-card")).toBeNull();
      expect(toast?.getAttribute("role")).toBe("alert");
      expect(page.shadowRoot?.querySelector<HTMLTextAreaElement>(".prompt-input")?.value).toBe(
        "new prompt",
      );
      expect(page.shadowRoot?.querySelector(".active-prompt-text")?.textContent).toBe("old prompt");
      expect(root.preferencesStore.llmPrompt?.prompt).toBe("old prompt");
      expect(patchPreferences).not.toHaveBeenCalled();
      expect(page.shadowRoot?.querySelector(".prompt-card.thinking")).toBeNull();

      const input = page.shadowRoot?.querySelector<HTMLTextAreaElement>(".prompt-input");
      if (!input) throw new Error("Expected prompt input");
      input.value = "edited draft";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await settle(page);
      expect(page.shadowRoot?.querySelector(".prompt-toast")).not.toBeNull();
      page.shadowRoot
        ?.querySelector<HTMLButtonElement>('[aria-label="Dismiss prompt error"]')
        ?.click();
      await settle(page);
      expect(page.shadowRoot?.querySelector(".prompt-toast")).toBeNull();
      expect(root.preferencesStore.llmPromptFailure).toBeNull();
    },
  );

  it("retains an error when the request fails after the settings page closes", async () => {
    const { root, failFit } = await makeRoot();
    const page = await openSettings();
    await sendPrompt(page, "a prompt");
    page.remove();
    failFit(new Error("boom"));
    await settle(page);
    const reopened = await openSettings();
    expect(reopened.shadowRoot?.querySelector(".prompt-toast")?.textContent).toContain(
      "Something went wrong",
    );
    await sendPrompt(reopened, "another prompt");
    expect(root.preferencesStore.llmPromptFailure).toBeNull();
    expect(reopened.shadowRoot?.querySelector(".prompt-toast")).toBeNull();
  });

  it("undoes the automatic weight and restores defaults without changing prompt or draft", async () => {
    const { root, finishFit } = await makeRoot();
    const page = await openSettings();
    await sendPrompt(page, "saved prompt");
    finishFit();
    await settle(page);
    const input = page.shadowRoot?.querySelector<HTMLTextAreaElement>(".prompt-input");
    if (!input) throw new Error("Expected input");
    input.value = "unsent draft";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(page);

    const click = async (label: string) => {
      page.shadowRoot?.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click();
      await settle(page);
      expect(root.preferencesStore.llmPrompt?.prompt).toBe("saved prompt");
      expect(input.value).toBe("unsent draft");
    };
    await click("Undo last settings change");
    expect(root.preferencesStore.valuesFor("your-feed").sourceWeights.llm).toBe(0);
    await click("Redo last settings change");
    expect(root.preferencesStore.valuesFor("your-feed").sourceWeights.llm).toBe(0.2);
    page.shadowRoot?.querySelector<HTMLButtonElement>(".reset-defaults-btn")?.click();
    await settle(page);
    expect(root.preferencesStore.valuesFor("your-feed").sourceWeights.llm).toBe(0);
    expect(root.preferencesStore.llmPrompt?.prompt).toBe("saved prompt");
    expect(input.value).toBe("unsent draft");
    await click("Undo last settings change");
    expect(root.preferencesStore.valuesFor("your-feed").sourceWeights.llm).toBe(0.2);
    await click("Redo last settings change");
    expect(root.preferencesStore.valuesFor("your-feed").sourceWeights.llm).toBe(0);
  });

  it("removes the prompt, keeps the draft and clears obsolete history and locks", async () => {
    const { root, finishFit, finishRemoval, removeLlmPrompt } = await makeRoot();
    const page = await openSettings();
    await sendPrompt(page, "saved prompt");
    finishFit();
    await settle(page);
    page.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Lock Prompt weight"]')?.click();
    const input = page.shadowRoot?.querySelector<HTMLTextAreaElement>(".prompt-input");
    if (!input) throw new Error("Expected input");
    input.value = "unsent replacement";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(page);
    expect(
      page.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Undo last settings change"]')
        ?.disabled,
    ).toBe(false);
    page.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Remove active prompt"]')
      ?.click();
    await settle(page);
    expect(removeLlmPrompt).toHaveBeenCalledWith("v1");
    expect(
      page.shadowRoot?.querySelector('[aria-label="Remove active prompt"]')?.textContent,
    ).toContain("Removing…");
    expect(page.shadowRoot?.querySelector<HTMLButtonElement>(".prompt-send-btn")?.disabled).toBe(
      true,
    );
    expect(page.shadowRoot?.querySelector<HTMLButtonElement>(".reset-defaults-btn")?.disabled).toBe(
      true,
    );
    expect(
      page.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Undo last settings change"]')
        ?.disabled,
    ).toBe(true);
    expect(page.shadowRoot?.querySelector(".active-prompt-text")?.textContent).toBe("saved prompt");
    finishRemoval();
    await settle(page);
    expect(input.value).toBe("unsent replacement");
    expect(page.shadowRoot?.querySelector(".active-prompt")).toBeNull();
    expect(root.preferencesStore.llmPrompt).toBeNull();
    expect(root.preferencesStore.valuesFor("your-feed").sourceWeights.llm).toBe(0);
    expect(
      page.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Undo last settings change"]')
        ?.disabled,
    ).toBe(true);
    expect(page.shadowRoot?.querySelectorAll('[aria-pressed="true"]').length).toBe(0);
    expect(page.shadowRoot?.querySelector<HTMLButtonElement>("#update-preview")?.disabled).toBe(
      false,
    );
  });

  it("preserves prompt, draft and history when removal fails", async () => {
    const { root, finishFit, failRemoval } = await makeRoot();
    const page = await openSettings();
    await sendPrompt(page, "saved prompt");
    finishFit();
    await settle(page);
    const weights = { ...root.preferencesStore.valuesFor("your-feed").sourceWeights };
    const input = page.shadowRoot?.querySelector<HTMLTextAreaElement>(".prompt-input");
    if (!input) throw new Error("Expected input");
    input.value = "unsent draft";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(page);
    page.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Remove active prompt"]')
      ?.click();
    await settle(page);
    failRemoval(new Error("internal diagnostics"));
    await settle(page);
    expect(page.shadowRoot?.querySelector(".prompt-toast")?.textContent).toContain(
      "We couldn’t remove your prompt",
    );
    expect(page.shadowRoot?.querySelector(".active-prompt-text")?.textContent).toBe("saved prompt");
    expect(input.value).toBe("unsent draft");
    expect(root.preferencesStore.valuesFor("your-feed").sourceWeights).toEqual(weights);
    expect(
      page.shadowRoot?.querySelector<HTMLButtonElement>('[aria-label="Undo last settings change"]')
        ?.disabled,
    ).toBe(false);
  });

  it("applies a removal to a reopened page even when the old page is gone", async () => {
    const { root, finishRemoval } = await makeRoot({
      promptKey: "old",
      prompt: "saved",
      createdAt: "2026-09-17T10:00:00Z",
    });
    const oldPage = await openSettings();
    oldPage.shadowRoot
      ?.querySelector<HTMLButtonElement>('[aria-label="Remove active prompt"]')
      ?.click();
    await settle(oldPage);
    oldPage.remove();
    const reopened = await openSettings();
    finishRemoval();
    await settle(reopened);
    expect(reopened.shadowRoot?.querySelector(".active-prompt")).toBeNull();
    expect(root.preferencesStore.llmPromptResetFresh).toBe(false);
    expect(reopened.shadowRoot?.querySelector<HTMLButtonElement>("#update-preview")?.disabled).toBe(
      false,
    );
  });

  it("keeps automatic saving for short inputs without an interpretation or review step", async () => {
    const { root, finishFit } = await makeRoot();
    const page = await openSettings();
    await sendPrompt(page, "xshby");
    finishFit();
    await settle(page);
    expect(root.preferencesStore.llmPrompt?.prompt).toBe("xshby");
    expect(page.shadowRoot?.querySelector(".active-prompt-text")?.textContent).toBe("xshby");
    expect(page.shadowRoot?.querySelector(".prompt-toast")).toBeNull();
  });
});
