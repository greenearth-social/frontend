import { describe, expect, it, vi } from "vitest";
import type { LlmPrompt } from "../services/types";
import { FeedApiError } from "../services/types";
import type { RootStore } from "../stores/root-store";
import { LlmFilterStore } from "../stores/llm-filter-store";

const filterPrompt: LlmPrompt = {
  promptKey: "f1",
  prompt: "be uplifting, no airplanes",
  createdAt: "2026-11-02T10:00:00Z",
};

function makeStore(current: LlmPrompt | null = null) {
  const capture = vi.fn();
  const root = {
    services: {
      feedApiService: {
        getLlmPrompt: vi.fn().mockResolvedValue({ enabled: true, prompt: current }),
        fitLlmPrompt: vi.fn().mockResolvedValue(filterPrompt),
        removeLlmPrompt: vi.fn().mockResolvedValue({}),
      },
      analyticsService: { capture },
    },
  } as unknown as RootStore;
  return { store: new LlmFilterStore(root), root, capture };
}

describe("LlmFilterStore", () => {
  it("fits under role=filter and reports the role to analytics", async () => {
    const { store, root, capture } = makeStore();
    const fit = store.fit("I don't want airplanes");
    expect(store.isFitting).toBe(true);
    expect(await fit).toEqual(filterPrompt);
    expect(store.isFitting).toBe(false);
    expect(store.prompt).toEqual(filterPrompt);
    expect(root.services.feedApiService.fitLlmPrompt).toHaveBeenCalledWith(
      "I don't want airplanes",
      "filter",
    );
    expect(capture).toHaveBeenCalledWith(
      "promptFitted",
      expect.objectContaining({ feed_name: "your-feed", prompt_role: "filter" }),
    );
  });

  it("re-reads the prompt after a conflict and keeps the failure", async () => {
    const { store, root } = makeStore(filterPrompt);
    await store.load("acct-1");
    const other = { ...filterPrompt, promptKey: "f9", prompt: "be about boats" };
    root.services.feedApiService.getLlmPrompt = vi
      .fn()
      .mockResolvedValue({ enabled: true, prompt: other });
    root.services.feedApiService.removeLlmPrompt = vi.fn().mockRejectedValue(
      new FeedApiError(409, "Prompt changed", {
        detail: { code: "llm_query_vector_prompt_changed" },
      }),
    );

    expect(await store.remove("f1")).toBe(false);

    expect(store.prompt).toEqual(other);
    expect(store.failure?.category).toBe("prompt_changed");
  });
});
