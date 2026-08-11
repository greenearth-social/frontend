import { describe, expect, it } from "vitest";
import {
  applySourceLocks,
  blendSourceWeightsToRank,
  redistributeSourceWeights,
  SOURCE_RANK_PRESETS,
  sourceRankPosition,
  sourceRankValueText,
  sourceWeightRange,
  sourceWeightsAtRank,
} from "../utils/source-weight-math";

describe("source-weight math", () => {
  it("preserves the other three sources proportionally", () => {
    expect(
      redistributeSourceWeights(
        { following: 0.3, networkLikes: 0.2, authorsTopics: 0.25, popular: 0.25 },
        "following",
        0.4,
      ),
    ).toEqual({ following: 0.4, networkLikes: 0.17, authorsTopics: 0.22, popular: 0.21 });
  });

  it("allows every source to reach zero or one while preserving exact cents", () => {
    const maximum = redistributeSourceWeights(
      { following: 0.3, networkLikes: 0.2, authorsTopics: 0.25, popular: 0.25 },
      "networkLikes",
      1,
    );
    expect(maximum).toEqual({ following: 0, networkLikes: 1, authorsTopics: 0, popular: 0 });
    expect(
      maximum.following
      + maximum.networkLikes
      + maximum.authorsTopics
      + maximum.popular,
    ).toBe(1);

    const quantized = redistributeSourceWeights(
      { following: 0.3, networkLikes: 0.2, authorsTopics: 0.25, popular: 0.25 },
      "following",
      0.537,
    );
    expect(quantized.following).toBe(0.54);
    expect(Object.values(quantized).every((value) => Number.isInteger(value * 100))).toBe(true);
    expect(
      quantized.following
      + quantized.networkLikes
      + quantized.authorsTopics
      + quantized.popular,
    ).toBe(1);
  });

  it("splits the remainder deterministically when the other sources are zero", () => {
    expect(
      redistributeSourceWeights(
        { following: 1, networkLikes: 0, authorsTopics: 0, popular: 0 },
        "following",
        0,
      ),
    ).toEqual({ following: 0, networkLikes: 0.34, authorsTopics: 0.33, popular: 0.33 });
  });

  it("keeps locked sources fixed and redistributes whole percentage points", () => {
    const current = {
      following: 0.3,
      networkLikes: 0.2,
      authorsTopics: 0.25,
      popular: 0.25,
    };
    const changed = redistributeSourceWeights(
      current,
      "following",
      0.41,
      ["networkLikes", "popular"],
    );
    expect(changed).toEqual({
      following: 0.41,
      networkLikes: 0.2,
      authorsTopics: 0.14,
      popular: 0.25,
    });
    expect(
      Object.values(changed).every(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
      ),
    ).toBe(true);
  });

  it("constrains edits and Source Rank to the remaining unlocked budget", () => {
    const current = {
      following: 0.3,
      networkLikes: 0.2,
      authorsTopics: 0.25,
      popular: 0.25,
    };
    expect(sourceWeightRange(current, "popular", [
      "following",
      "networkLikes",
      "authorsTopics",
    ])).toEqual({ min: 0.25, max: 0.25 });
    const friendsPreset = SOURCE_RANK_PRESETS[0];
    if (!friendsPreset) throw new Error("Expected Friends preset");
    expect(applySourceLocks(current, friendsPreset, ["networkLikes"])).toEqual({
      following: 0.8,
      networkLikes: 0.2,
      authorsTopics: 0,
      popular: 0,
    });
  });

  it("matches all five API presets and interpolates between them", () => {
    SOURCE_RANK_PRESETS.forEach((preset, index) => {
      expect(sourceWeightsAtRank(index)).toEqual(preset);
      expect(sourceRankPosition(preset)).toBeCloseTo(index, 6);
    });
    const halfway = sourceWeightsAtRank(2.5);
    expect(halfway).toEqual({
      following: 0.4,
      networkLikes: 0.2,
      authorsTopics: 0.2,
      popular: 0.2,
    });
  });

  it("places Network Likes in the middle and blends custom mixes without jumping", () => {
    const networkOnly = { following: 0, networkLikes: 1, authorsTopics: 0, popular: 0 };
    expect(sourceRankPosition(networkOnly)).toBeCloseTo(2.5, 6);
    expect(blendSourceWeightsToRank(networkOnly, 2.5)).toEqual(networkOnly);
    expect(sourceRankPosition(blendSourceWeightsToRank(networkOnly, 2.75))).toBeCloseTo(2.75, 1);
    expect(blendSourceWeightsToRank(networkOnly, 4)).toEqual(SOURCE_RANK_PRESETS[4]);
  });

  it("provides meaningful accessible rank labels", () => {
    expect(sourceRankValueText(0)).toBe("Friends");
    expect(sourceRankValueText(4)).toBe("All");
    expect(sourceRankValueText(2.5)).toBe("Between Middle and Balanced");
  });
});
