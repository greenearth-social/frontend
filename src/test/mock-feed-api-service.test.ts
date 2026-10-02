import { describe, expect, it } from "vitest";
import { MockFeedApiService } from "../services/mock/mock-feed-api-service";

describe("MockFeedApiService preferences", () => {
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
      "best-of-friends": { freshness: 5, purpose: 0.65, politics: 2 },
    });
    expect(await new MockFeedApiService().getPreferences()).toEqual(defaults);
  });
});
