import { describe, expect, it } from "vitest";
import {
  feedScopedPath,
  parseKnownRoute,
  resolveFeedScopedRoute,
} from "../utils/app-route";

describe("feed-scoped routes", () => {
  it("builds and parses canonical routes", () => {
    expect(feedScopedPath("settings", "best-of-friends")).toBe(
      "/settings/best-of-friends",
    );
    expect(parseKnownRoute("/feedback/random")).toEqual({
      page: "feedback",
      feedName: "random",
    });
  });

  it("resolves bare and legacy routes with the remembered feed", () => {
    expect(resolveFeedScopedRoute("/feed", "random")?.path).toBe("/feed/random");
    expect(resolveFeedScopedRoute("/controls", "best-of-friends")?.path).toBe(
      "/settings/best-of-friends",
    );
    expect(resolveFeedScopedRoute("/how-it-works", null)?.path).toBe(
      "/settings/your-feed",
    );
  });

  it("uses GreenEarth for an invalid feed segment", () => {
    expect(resolveFeedScopedRoute("/feedback/removed-feed", "random")?.path).toBe(
      "/feedback/your-feed",
    );
  });

  it("rejects unknown pages and extra path segments", () => {
    expect(resolveFeedScopedRoute("/unknown", "your-feed")).toBeNull();
    expect(resolveFeedScopedRoute("/feed/random/extra", "your-feed")).toBeNull();
  });
});
