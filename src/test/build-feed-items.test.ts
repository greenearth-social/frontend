import { describe, it, expect } from "vitest";
import {
  buildFeedItems,
  scoreAxisPositionPct,
  atUriToBskyUrl,
  weightedRankScore,
  mediaLabelsFor,
} from "../models/feed-debug-snapshot";
import type {
  FeedDebugDocument,
  CandidatePost,
} from "../models/feed-debug-snapshot";
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

describe("atUriToBskyUrl", () => {
  it("converts an AT URI to a Bluesky URL", () => {
    expect(
      atUriToBskyUrl(
        "at://did:plc:abc/app.bsky.feed.post/3jxyz123",
      ),
    ).toBe("https://bsky.app/profile/did:plc:abc/post/3jxyz123");
  });

  it("returns null for invalid URIs", () => {
    expect(atUriToBskyUrl("https://example.com")).toBeNull();
    expect(atUriToBskyUrl("")).toBeNull();
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

describe("mediaLabelsFor", () => {
  const base: CandidatePost = {
    atUri: "at://did/app.bsky.feed.post/1",
    content: "hello",
    score: 0.5,
    authorDid: "did:plc:a",
    authorUsername: "user",
    containsImages: null,
    containsVideo: null,
    imageCount: null,
    videoCount: null,
    externalUri: null,
  };

  it("returns empty for no media", () => {
    expect(mediaLabelsFor(base)).toEqual([]);
  });

  it("shows image count", () => {
    expect(mediaLabelsFor({ ...base, imageCount: 2 })).toEqual(["2 images"]);
    expect(mediaLabelsFor({ ...base, imageCount: 1 })).toEqual(["1 image"]);
  });

  it("shows video count", () => {
    expect(mediaLabelsFor({ ...base, videoCount: 1 })).toEqual(["1 video"]);
  });

  it("shows external link", () => {
    expect(mediaLabelsFor({ ...base, externalUri: "https://x.com" })).toEqual([
      "link",
    ]);
  });

  it("shows fallback boolean flags when count is null", () => {
    expect(mediaLabelsFor({ ...base, containsImages: true })).toEqual(["image"]);
    expect(mediaLabelsFor({ ...base, containsVideo: true })).toEqual(["video"]);
  });
});

describe("buildFeedItems", () => {
  const doc = sampleFixture as unknown as FeedDebugDocument;

  it("produces correct number of items from finalOrder", () => {
    const items = buildFeedItems(doc);
    expect(items).toHaveLength(doc.finalOrder.length);
  });

  it("sets final position correctly (1-indexed)", () => {
    const items = buildFeedItems(doc);
    expect(items[0]).toBeDefined();
    expect(items[items.length - 1]).toBeDefined();
    expect(items[0]?.finalPosition).toBe(1);
    expect(items[items.length - 1]?.finalPosition).toBe(items.length);
  });

  it("merges generator contributions", () => {
    const items = buildFeedItems(doc);
    expect(items[0]).toBeDefined();
    const first = items[0];
    expect(first?.generators.length).toBeGreaterThan(0);
    const names = first?.generators.map((g) => g.name);
    expect(names).toContain("two_tower");
  });

  it("includes rank information", () => {
    const items = buildFeedItems(doc);
    const withRank = items.find((i) => i.rankPosition !== null);
    expect(withRank).toBeDefined();
  });

  it("maps model scores per URI", () => {
    const items = buildFeedItems(doc);
    expect(items[0]).toBeDefined();
    const first = items[0];
    if (first && first.modelScores.length > 0) {
      expect(first.modelScores[0]).toHaveProperty("name");
      expect(first.modelScores[0]).toHaveProperty("weight");
      expect(first.modelScores[0]).toHaveProperty("score");
    }
  });

  it("includes diversification when present", () => {
    const items = buildFeedItems(doc);
    const withDiv = items.find((i) => i.diversification !== null);
    expect(withDiv).toBeDefined();
    expect(withDiv?.diversification).toHaveProperty("relevance");
    expect(withDiv?.diversification).toHaveProperty("authorPenalty");
  });

  it("builds Bluesky URLs", () => {
    const items = buildFeedItems(doc);
    for (const item of items) {
      expect(item.postUrl).toMatch(/^https:\/\/bsky\.app\/profile\//);
    }
  });

  it("merges hydrated data", () => {
    const hydrated = new Map<string, { text: string; authorHandle: string }>();
    hydrated.set("at://did:plc:author1/app.bsky.feed.post/post1", {
      text: "Hydrated text",
      authorHandle: "hydrated.user",
    });
    const items = buildFeedItems(doc, hydrated);
    const found = items.find(
      (i) => i.atUri === "at://did:plc:author1/app.bsky.feed.post/post1",
    );
    expect(found).toBeDefined();
  });

  it("handles empty modelScores", () => {
    const emptyDoc: FeedDebugDocument = {
      ...doc,
      modelScores: [],
      ranking: null,
    };
    const items = buildFeedItems(emptyDoc);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.modelScores).toEqual([]);
    }
  });

  it("handles missing metadata gracefully", () => {
    const orphanDoc: FeedDebugDocument = {
      ...doc,
      finalOrder: ["at://did:plc:ghost/app.bsky.feed.post/ghost"],
      generatorOutputs: [],
      finalCandidates: [],
      modelScores: [],
      diversification: [],
      orderAfterRank: [],
      ranking: { rankings: [] },
    };
    const items = buildFeedItems(orphanDoc);
    expect(items).toHaveLength(1);
    expect(items[0]).toBeDefined();
    expect(items[0]?.author).toBe("unknown author");
    expect(items[0]?.content).toBe("");
    expect(items[0]?.generators).toEqual([]);
  });
});
