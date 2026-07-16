import { describe, expect, it } from "vitest";
import {
  nearestPresetIndex,
  POLITICS_PRESETS,
  PURPOSE_PRESETS,
  SOCIAL_RADIUS_PRESETS,
} from "../constants/preferences";

describe("preference presets", () => {
  it("derives social labels from configured generator weights", () => {
    const center = SOCIAL_RADIUS_PRESETS[2];

    expect(center?.weights).toEqual(
      expect.arrayContaining([
        { name: "followed_users", weight: 0.4 },
        { name: "two_tower", weight: 0.3 },
        { name: "popularity", weight: 0.3 },
      ]),
    );
    expect(center?.displayLines).toEqual(["F:0.40", "E:0.60"]);

    for (const preset of SOCIAL_RADIUS_PRESETS) {
      const authorTopic = preset.weights.find(({ name }) => name === "two_tower")?.weight;
      const popular = preset.weights.find(({ name }) => name === "popularity")?.weight;
      expect(authorTopic).toBe(popular);
    }
  });

  it("defines five politics presets centered at 1.00", () => {
    expect(POLITICS_PRESETS.map((preset) => preset.value)).toEqual([
      0.5, 0.75, 1, 1.25, 1.5,
    ]);
    expect(POLITICS_PRESETS[2]?.displayLines).toEqual(["1.00"]);
  });

  it("defines five purpose pairs that sum to one", () => {
    expect(PURPOSE_PRESETS).toHaveLength(5);
    for (const preset of PURPOSE_PRESETS) {
      const engaging = 1 - preset.value;
      expect(engaging + preset.value).toBeCloseTo(1);
    }
    expect(PURPOSE_PRESETS[2]?.displayLines).toEqual(["E:0.50", "C:0.50"]);
  });

  it("maps exact and non-preset values to the nearest stage", () => {
    expect(nearestPresetIndex(POLITICS_PRESETS, 1)).toBe(2);
    expect(nearestPresetIndex(POLITICS_PRESETS, 1.12)).toBe(2);
    expect(nearestPresetIndex(PURPOSE_PRESETS, 0.72)).toBe(3);
  });
});
