import { describe, it, expect } from "vitest";
import {
  scoreAxisPositionPct,
  weightedRankScore,
  transformFeedItems,
} from "../models/feed-debug-snapshot";
import type { ApiFeedItem } from "../models/feed-debug-snapshot";
import sampleFixture from "./fixtures/sample-feed-debug.json";

describe("scoreAxisPositionPct", () => {
  it("maps -1 to 0%", () => {
    expect(scoreAxisPositionPct(-1)).toBe(0);
  });

  it("maps 0 to 50%", () => {
    expect(scoreAxisPositionPct(0)).toBe(50);
  });

  it("maps 1 to 100%", () => {
    expect(scoreAxisPositionPct(1)).toBe(100);
  });

  it("clamps values outside [-1, 1]", () => {
    expect(scoreAxisPositionPct(-2)).toBe(0);
    expect(scoreAxisPositionPct(2)).toBe(100);
  });
});

describe("weightedRankScore", () => {
  it("computes weighted average", () => {
    const scores = [
      { name: "a", weight: 0.6, score: 0.8 },
      { name: "b", weight: 0.4, score: 0.5 },
    ];
    expect(weightedRankScore(scores)).toBeCloseTo(0.68);
  });

  it("returns null for zero total weight", () => {
    expect(weightedRankScore([])).toBeNull();
    expect(weightedRankScore([{ name: "a", weight: 0, score: 0.5 }])).toBeNull();
  });
});

describe("transformFeedItems", () => {
  const items = (sampleFixture as unknown as { items: ApiFeedItem[] }).items;

  it("produces correct number of items", () => {
    const result = transformFeedItems(items);
    expect(result).toHaveLength(items.length);
  });

  it("sets final position correctly (1-indexed)", () => {
    const result = transformFeedItems(items);
    expect(result[0]).toBeDefined();
    expect(result[0]?.finalPosition).toBe(1);
    expect(result[result.length - 1]?.finalPosition).toBe(result.length);
  });

  it("flattens author object to string fields", () => {
    const result = transformFeedItems(items);
    expect(result[0]?.author).toBe("@alice.bsky.social");
    expect(result[0]?.displayName).toBe("Alice Chen");
    expect(result[0]?.avatarUrl).toBeNull();
  });

  it("flattens media object", () => {
    const result = transformFeedItems(items);
    const withImages = result.find((i) => i.mediaLabels.includes("2 images"));
    expect(withImages).toBeDefined();
    expect(withImages?.imageUrls).toHaveLength(2);
  });

  it("flattens engagement object", () => {
    const result = transformFeedItems(items);
    expect(result[0]?.replyCount).toBe(5);
    expect(result[0]?.repostCount).toBe(12);
    expect(result[0]?.likeCount).toBe(47);
  });

  it("preserves generators", () => {
    const result = transformFeedItems(items);
    expect(result[0]?.generators.length).toBeGreaterThan(0);
    const names = result[0]?.generators.map((g) => g.name) ?? [];
    expect(names).toContain("two_tower");
  });

  it("preserves model scores", () => {
    const result = transformFeedItems(items);
    expect(result[0]?.modelScores.length).toBeGreaterThan(0);
    expect(result[0]?.modelScores[0]).toHaveProperty("name");
    expect(result[0]?.modelScores[0]).toHaveProperty("weight");
    expect(result[0]?.modelScores[0]).toHaveProperty("score");
  });

  it("preserves rank fields", () => {
    const result = transformFeedItems(items);
    const withRank = result.find((i) => i.rankPosition !== null);
    expect(withRank).toBeDefined();
  });

  it("preserves diversification", () => {
    const result = transformFeedItems(items);
    const withDiv = result.find((i) => i.diversification !== null);
    expect(withDiv).toBeDefined();
    expect(withDiv?.diversification).toHaveProperty("relevance");
    expect(withDiv?.diversification).toHaveProperty("authorPenalty");
  });

  it("handles missing media gracefully", () => {
    const noMedia: ApiFeedItem[] = [
      {
        atUri: "at://did/app.bsky.feed.post/1",
        rank: null,
        rankScore: null,
        afterRankPosition: null,
        author: { handle: null, displayName: null, avatarUrl: null },
        createdAt: null,
        content: null,
        generators: [],
        modelScores: [],
        diversification: null,
        media: null,
        engagement: null,
        postUrl: null,
      },
    ];
    const result = transformFeedItems(noMedia);
    expect(result).toHaveLength(1);
    expect(result[0]?.author).toBe("unknown author");
    expect(result[0]?.content).toBe("");
    expect(result[0]?.mediaLabels).toEqual([]);
    expect(result[0]?.generators).toEqual([]);
    expect(result[0]?.replyCount).toBe(0);
  });
});
