import { runtimeConfig } from "../config";

export type AlgorithmId = "your-feed" | "best-of-friends" | "random";

export interface AlgorithmConfig {
  label: string;
  blueskyUrl: string;
  icon: string;
}

export const ALGORITHMS: Record<AlgorithmId, AlgorithmConfig> = {
  "your-feed": {
    label: "GreenEarth",
    get blueskyUrl() { return runtimeConfig.blueskyUrls["your-feed"]; },
    icon: "algo-greenearth",
  },
  "best-of-friends": {
    label: "Best of Friends",
    get blueskyUrl() { return runtimeConfig.blueskyUrls["best-of-friends"]; },
    icon: "algo-best-of-friends",
  },
  random: {
    label: "Random",
    get blueskyUrl() { return runtimeConfig.blueskyUrls["random"]; },
    icon: "algo-random",
  },
};

export const ALGORITHM_IDS: AlgorithmId[] = ["your-feed", "best-of-friends", "random"];

export const ALGORITHM_FEED_NAME_SET = new Set<string>(ALGORITHM_IDS);
