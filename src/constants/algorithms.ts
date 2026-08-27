import { runtimeConfig } from "../config";

export type AlgorithmId = "your-feed" | "best-of-friends" | "random";

export interface AlgorithmConfig {
  label: string;
  analyticsLabel: string;
  blueskyUrl: string;
  icon: string;
}

export const ALGORITHMS: Record<AlgorithmId, AlgorithmConfig> = {
  "your-feed": {
    label: "MySky",
    analyticsLabel: "GreenEarth",
    get blueskyUrl() {
      return runtimeConfig.blueskyUrls["your-feed"];
    },
    icon: "algo-greenearth",
  },
  "best-of-friends": {
    label: "Best of Friends",
    analyticsLabel: "Best of Friends",
    get blueskyUrl() {
      return runtimeConfig.blueskyUrls["best-of-friends"];
    },
    icon: "algo-best-of-friends",
  },
  random: {
    label: "Random",
    analyticsLabel: "Random",
    get blueskyUrl() {
      return runtimeConfig.blueskyUrls["random"];
    },
    icon: "algo-random",
  },
};

export const ALGORITHM_IDS: AlgorithmId[] = ["your-feed", "best-of-friends", "random"];

export const ALGORITHM_FEED_NAME_SET = new Set<string>(ALGORITHM_IDS);

const ALGORITHM_FEED_ALIASES: Record<string, AlgorithmId> = {
  "your-feed": "your-feed",
  "a0-yf": "your-feed",
  "best-of-friends": "best-of-friends",
  "fd-bof": "best-of-friends",
  random: "random",
  "67-r": "random",
};

export function isAlgorithmId(value: string | null | undefined): value is AlgorithmId {
  return value !== null && value !== undefined && ALGORITHM_FEED_NAME_SET.has(value);
}

export function canonicalAlgorithmId(value: string | null | undefined): AlgorithmId | null {
  return value ? (ALGORITHM_FEED_ALIASES[value] ?? null) : null;
}

export function feedAnalyticsProperties(feedName: AlgorithmId): {
  feed_name: AlgorithmId;
  feed_label: string;
} {
  return {
    feed_name: feedName,
    feed_label: ALGORITHMS[feedName].analyticsLabel,
  };
}
