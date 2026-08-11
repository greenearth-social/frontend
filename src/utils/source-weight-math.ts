import type { SourceWeights } from "../services/types";

export type SourceWeightKey = keyof SourceWeights;

export const SOURCE_RANK_MIN = 0;
export const SOURCE_RANK_MAX = 4;

export const SOURCE_WEIGHT_BOUNDS: Record<
  SourceWeightKey,
  { min: number; max: number }
> = {
  following: { min: 0, max: 1 },
  networkLikes: { min: 0, max: 1 },
  authorsTopics: { min: 0, max: 1 },
  popular: { min: 0, max: 1 },
};

const FRIENDS_PRESET: SourceWeights = {
  following: 1,
  networkLikes: 0,
  authorsTopics: 0,
  popular: 0,
};
const EVERYONE_PRESET: SourceWeights = {
  following: 0.1,
  networkLikes: 0.1,
  authorsTopics: 0.4,
  popular: 0.4,
};

export const SOURCE_RANK_PRESETS: readonly SourceWeights[] = [
  FRIENDS_PRESET,
  { following: 0.7, networkLikes: 0.1, authorsTopics: 0.1, popular: 0.1 },
  { following: 0.5, networkLikes: 0.2, authorsTopics: 0.15, popular: 0.15 },
  { following: 0.3, networkLikes: 0.2, authorsTopics: 0.25, popular: 0.25 },
  EVERYONE_PRESET,
];

const SOURCE_KEYS = Object.keys(SOURCE_WEIGHT_BOUNDS) as SourceWeightKey[];
const SOURCE_RANK_LABELS = ["Friends", "Closer", "Middle", "Balanced", "All"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fromCents(value: number): number {
  return value / 100;
}

function allocateCents(
  keys: SourceWeightKey[],
  desired: Record<SourceWeightKey, number>,
  total: number,
): Record<SourceWeightKey, number> {
  const allocated = Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, 0]),
  ) as Record<SourceWeightKey, number>;
  const ranked = keys.map((key, index) => {
    const floor = Math.floor(desired[key]);
    allocated[key] = floor;
    return { key, index, fraction: desired[key] - floor };
  }).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  let remaining = total - keys.reduce((sum, key) => sum + allocated[key], 0);
  for (let index = 0; remaining > 0; index++, remaining--) {
    const item = ranked[index % ranked.length];
    if (item) allocated[item.key]++;
  }
  return allocated;
}

function quantizeWeights(weights: SourceWeights): SourceWeights {
  const desired = Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, clamp(weights[key], 0, 1) * 100]),
  ) as Record<SourceWeightKey, number>;
  const total = SOURCE_KEYS.reduce((sum, key) => sum + desired[key], 0);
  if (total <= 0) return { ...FRIENDS_PRESET };
  const normalized = Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, (desired[key] / total) * 100]),
  ) as Record<SourceWeightKey, number>;
  const cents = allocateCents(SOURCE_KEYS, normalized, 100);
  return Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, fromCents(cents[key])]),
  ) as unknown as SourceWeights;
}

export function redistributeSourceWeights(
  current: SourceWeights,
  changed: SourceWeightKey,
  requestedValue: number,
  lockedKeys: readonly SourceWeightKey[] = [],
): SourceWeights {
  const locked = new Set(lockedKeys);
  const otherKeys = SOURCE_KEYS.filter((key) => key !== changed);
  const fixedKeys = otherKeys.filter((key) => locked.has(key));
  const adjustableKeys = otherKeys.filter((key) => !locked.has(key));
  const fixedCents = fixedKeys.reduce(
    (sum, key) => sum + Math.round(current[key] * 100),
    0,
  );
  const availableCents = Math.max(0, 100 - fixedCents);
  const changedBounds = sourceWeightRange(current, changed, lockedKeys);
  const changedCents = Math.round(
    clamp(requestedValue, changedBounds.min, changedBounds.max) * 100,
  );
  const remaining = availableCents - changedCents;
  const priorTotal = adjustableKeys.reduce((sum, key) => sum + current[key], 0);
  const desired = Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, 0]),
  ) as Record<SourceWeightKey, number>;
  for (const key of adjustableKeys) {
    desired[key] = priorTotal > 0
      ? remaining * (current[key] / priorTotal)
      : remaining / adjustableKeys.length;
  }
  const cents = allocateCents(adjustableKeys, desired, remaining);
  for (const key of fixedKeys) cents[key] = Math.round(current[key] * 100);
  cents[changed] = changedCents;
  return Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, fromCents(cents[key])]),
  ) as unknown as SourceWeights;
}

export function sourceWeightRange(
  current: SourceWeights,
  changed: SourceWeightKey,
  lockedKeys: readonly SourceWeightKey[] = [],
): { min: number; max: number } {
  const locked = new Set(lockedKeys);
  const otherKeys = SOURCE_KEYS.filter((key) => key !== changed);
  const fixedCents = otherKeys
    .filter((key) => locked.has(key))
    .reduce((sum, key) => sum + Math.round(current[key] * 100), 0);
  const hasAdjustableSibling = otherKeys.some((key) => !locked.has(key));
  const available = fromCents(Math.max(0, 100 - fixedCents));
  return hasAdjustableSibling
    ? { min: 0, max: available }
    : { min: available, max: available };
}

export function applySourceLocks(
  current: SourceWeights,
  target: SourceWeights,
  lockedKeys: readonly SourceWeightKey[] = [],
): SourceWeights {
  if (lockedKeys.length === 0) return quantizeWeights(target);
  const locked = new Set(lockedKeys);
  const fixedKeys = SOURCE_KEYS.filter((key) => locked.has(key));
  const adjustableKeys = SOURCE_KEYS.filter((key) => !locked.has(key));
  if (adjustableKeys.length === 0) return quantizeWeights(current);

  const cents = Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, 0]),
  ) as Record<SourceWeightKey, number>;
  const fixedTotal = fixedKeys.reduce((sum, key) => {
    const value = Math.round(current[key] * 100);
    cents[key] = value;
    return sum + value;
  }, 0);
  const remaining = Math.max(0, 100 - fixedTotal);
  const targetTotal = adjustableKeys.reduce((sum, key) => sum + target[key], 0);
  const currentTotal = adjustableKeys.reduce((sum, key) => sum + current[key], 0);
  const desired = Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, 0]),
  ) as Record<SourceWeightKey, number>;
  for (const key of adjustableKeys) {
    desired[key] = targetTotal > 0
      ? remaining * (target[key] / targetTotal)
      : currentTotal > 0
        ? remaining * (current[key] / currentTotal)
        : remaining / adjustableKeys.length;
  }
  const adjustableCents = allocateCents(adjustableKeys, desired, remaining);
  for (const key of adjustableKeys) cents[key] = adjustableCents[key];
  return Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, fromCents(cents[key])]),
  ) as unknown as SourceWeights;
}

function discoveryCoordinate(weights: SourceWeights): number {
  return weights.authorsTopics + weights.popular + 0.5 * weights.networkLikes;
}

const SOURCE_RANK_ANCHORS = SOURCE_RANK_PRESETS.map(discoveryCoordinate);

export function sourceRankPosition(weights: SourceWeights): number {
  const coordinate = discoveryCoordinate(weights);
  const first = SOURCE_RANK_ANCHORS[0] ?? 0;
  const last = SOURCE_RANK_ANCHORS[SOURCE_RANK_ANCHORS.length - 1] ?? 1;
  if (coordinate <= first) return SOURCE_RANK_MIN;
  if (coordinate >= last) return SOURCE_RANK_MAX;
  for (let index = 0; index < SOURCE_RANK_ANCHORS.length - 1; index++) {
    const start = SOURCE_RANK_ANCHORS[index];
    const end = SOURCE_RANK_ANCHORS[index + 1];
    if (start === undefined || end === undefined || coordinate > end) continue;
    return index + (coordinate - start) / (end - start);
  }
  return SOURCE_RANK_MAX;
}

export function sourceRankValueText(value: number): string {
  const clamped = clamp(value, SOURCE_RANK_MIN, SOURCE_RANK_MAX);
  const rounded = Math.round(clamped);
  if (Math.abs(clamped - rounded) < 0.005) {
    return SOURCE_RANK_LABELS[rounded] ?? "Source mix";
  }
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  return `Between ${SOURCE_RANK_LABELS[lower] ?? "Friends"} and ${SOURCE_RANK_LABELS[upper] ?? "All"}`;
}

export function sourceWeightsAtRank(requestedRank: number): SourceWeights {
  const rank = clamp(requestedRank, SOURCE_RANK_MIN, SOURCE_RANK_MAX);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const lower = SOURCE_RANK_PRESETS[lowerIndex] ?? FRIENDS_PRESET;
  const upper = SOURCE_RANK_PRESETS[upperIndex] ?? EVERYONE_PRESET;
  const blend = rank - lowerIndex;
  return quantizeWeights(Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, lower[key] + (upper[key] - lower[key]) * blend]),
  ) as unknown as SourceWeights);
}

export function blendSourceWeightsToRank(
  current: SourceWeights,
  requestedRank: number,
): SourceWeights {
  const startRank = sourceRankPosition(current);
  const target = clamp(requestedRank, SOURCE_RANK_MIN, SOURCE_RANK_MAX);
  if (Math.abs(target - startRank) < 1e-9) return quantizeWeights(current);

  const movingTowardFriends = target < startRank;
  const boundary = movingTowardFriends
    ? Math.max(SOURCE_RANK_MIN, Math.ceil(startRank - 1e-9) - 1)
    : Math.min(SOURCE_RANK_MAX, Math.floor(startRank + 1e-9) + 1);
  const betweenStartAndBoundary = movingTowardFriends
    ? target >= boundary
    : target <= boundary;
  if (!betweenStartAndBoundary || boundary === startRank) {
    return sourceWeightsAtRank(target);
  }

  const endpoint = SOURCE_RANK_PRESETS[boundary] ?? FRIENDS_PRESET;
  const blend = (target - startRank) / (boundary - startRank);
  return quantizeWeights(Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, current[key] + (endpoint[key] - current[key]) * blend]),
  ) as unknown as SourceWeights);
}
