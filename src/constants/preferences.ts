export interface GeneratorSpec {
  name: string;
  weight: number;
}

export interface LifecyclePreset<T> {
  value: T;
  displayLines: string[];
}

const SOCIAL_RADIUS_WEIGHTS: GeneratorSpec[][] = [
  [
    { name: "followed_users", weight: 1.00 },
    { name: "two_tower", weight: 0.00 },
    { name: "popularity", weight: 0.00 },
  ],
  [
    { name: "followed_users", weight: 0.80 },
    { name: "two_tower", weight: 0.10 },
    { name: "popularity", weight: 0.10 },
  ],
  [
    { name: "followed_users", weight: 0.60 },
    { name: "two_tower", weight: 0.20 },
    { name: "popularity", weight: 0.20 },
  ],
  [
    { name: "followed_users", weight: 0.40 },
    { name: "two_tower", weight: 0.30 },
    { name: "popularity", weight: 0.30 },
  ],
  [
    { name: "followed_users", weight: 0.20 },
    { name: "two_tower", weight: 0.40 },
    { name: "popularity", weight: 0.40 },
  ],
];

function generatorWeight(weights: GeneratorSpec[], name: string): number {
  return weights.find((generator) => generator.name === name)?.weight ?? 0;
}

export const SOCIAL_RADIUS_PRESETS: Array<LifecyclePreset<number> & {
  weights: GeneratorSpec[];
}> = SOCIAL_RADIUS_WEIGHTS.map((weights, value) => ({
  value,
  weights,
  displayLines: [
    `F:${generatorWeight(weights, "followed_users").toFixed(2)}`,
    `E:${(
      generatorWeight(weights, "two_tower")
      + generatorWeight(weights, "popularity")
    ).toFixed(2)}`,
  ],
}));

export const FRESHNESS_PRESETS = [
  { label: "6h", hours: 6, iconSrc: "/assets/freshness_slider/6hr.png" },
  { label: "12h", hours: 12, iconSrc: "/assets/freshness_slider/12hr.png" },
  { label: "24h", hours: 24, iconSrc: "/assets/freshness_slider/24hr.png" },
  { label: "48h", hours: 48, iconSrc: "/assets/freshness_slider/2d.png" },
  { label: "72h", hours: 72, iconSrc: "/assets/freshness_slider/3d.png" },
  { label: "7d", hours: 168, iconSrc: "/assets/freshness_slider/7d.png" },
];

export const POLITICS_PRESETS: LifecyclePreset<number>[] = [
  0.5, 0.75, 1, 1.25, 1.5,
].map((value) => ({
  value,
  displayLines: [value.toFixed(2)],
}));

export const PURPOSE_PRESETS: LifecyclePreset<number>[] = [
  0.2, 0.35, 0.5, 0.65, 0.8,
].map((constructive) => ({
  value: constructive,
  displayLines: [
    `E:${(1 - constructive).toFixed(2)}`,
    `C:${constructive.toFixed(2)}`,
  ],
}));

export function nearestPresetIndex<T extends number>(
  presets: Array<LifecyclePreset<T>>,
  value: number,
): number {
  if (presets.length === 0) return 0;
  return presets.reduce(
    (nearest, preset, index) => {
      const nearestPreset = presets[nearest];
      if (!nearestPreset) return index;
      return Math.abs(preset.value - value) < Math.abs(nearestPreset.value - value)
        ? index
        : nearest;
    },
    0,
  );
}
