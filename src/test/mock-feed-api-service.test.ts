import { describe, expect, it } from "vitest";
import { MockFeedApiService } from "../services/mock/mock-feed-api-service";

describe("MockFeedApiService preferences", () => {
  it("clears the prompt persistently, redistributes its weight and allows idempotent removal", async () => {
    const service = new MockFeedApiService();
    const original = await service.getPreferences();
    const prompt = await service.fitLlmPrompt("original query");
    await service.patchPreferences("your-feed", {
      sourceWeights: {
        following: 0.24,
        networkLikes: 0.16,
        authorsTopics: 0.2,
        popular: 0.2,
        llm: 0.2,
      },
    });
    await service.removeLlmPrompt(prompt.promptKey);
    await expect(service.getLlmPrompt()).resolves.toEqual({ enabled: true, prompt: null });
    expect((await service.getPreferences())["your-feed"]?.sourceWeights).toEqual(
      original["your-feed"]?.sourceWeights,
    );
    await expect(service.removeLlmPrompt(prompt.promptKey)).resolves.toEqual(original["your-feed"]);
  });

  it("rejects a stale prompt key without changing the active prompt", async () => {
    const service = new MockFeedApiService();
    const current = await service.fitLlmPrompt("current query");
    await expect(service.removeLlmPrompt("stale")).rejects.toMatchObject({ status: 409 });
    await expect(service.getLlmPrompt()).resolves.toEqual({ enabled: true, prompt: current });
  });

  it("returns default source weights when removing a prompt with 100% weight", async () => {
    const service = new MockFeedApiService();
    const original = await service.getPreferences();
    const prompt = await service.fitLlmPrompt("all prompt");
    await service.patchPreferences("your-feed", {
      sourceWeights: {
        following: 0,
        networkLikes: 0,
        authorsTopics: 0,
        popular: 0,
        llm: 1,
      },
    });
    const saved = await service.removeLlmPrompt(prompt.promptKey);
    expect(saved.sourceWeights).toEqual(original["your-feed"]?.sourceWeights);
  });
  it("offers independent Politics controls for both ranked feeds and preserves sparse controls", async () => {
    const service = new MockFeedApiService();
    const defaults = await service.getPreferences();
    expect(defaults["your-feed"]?.politics).toBe(0.5);
    expect(defaults["best-of-friends"]?.politics).toBe(0.5);
    expect(defaults.random).not.toHaveProperty("politics");

    await expect(service.patchPreferences("your-feed", { politics: 0 })).resolves.toEqual({
      politics: 0,
    });
    const saved = await service.getPreferences();
    expect(saved).toEqual({
      ...defaults,
      "your-feed": { ...defaults["your-feed"], politics: 0 },
    });

    await service.patchPreferences("best-of-friends", { politics: 2 });
    await service.patchPreferences("best-of-friends", { purpose: 0.65 });
    expect(await service.getPreferences()).toEqual({
      ...saved,
      "best-of-friends": {
        freshness: 5,
        purpose: 0.65,
        politics: 2,
        authorPenalty: 0.7,
        topicPenalty: 0.7,
      },
    });
    expect(await new MockFeedApiService().getPreferences()).toEqual(defaults);
  });
});
