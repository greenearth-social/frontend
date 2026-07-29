export type AlgorithmId = "your-feed" | "best-of-friends" | "random";

export interface AlgorithmConfig {
  label: string;
  blueskyUrl: string;
  icon: string;
}

export const ALGORITHMS: Record<AlgorithmId, AlgorithmConfig> = {
  "your-feed": {
    label: "GreenEarth",
    blueskyUrl: "https://bsky.app/profile/did:plc:wrmpulygwvuhjn2c3jbalgqj/feed/a0-yf",
    icon: "algo-greenearth",
  },
  "best-of-friends": {
    label: "Best of Friends",
    blueskyUrl: "https://bsky.app/profile/did:plc:wrmpulygwvuhjn2c3jbalgqj/feed/fd-bof",
    icon: "algo-best-of-friends",
  },
  random: {
    label: "Random",
    blueskyUrl: "https://bsky.app/profile/did:plc:wrmpulygwvuhjn2c3jbalgqj/feed/67-r",
    icon: "algo-random",
  },
};

export const ALGORITHM_IDS: AlgorithmId[] = ["your-feed", "best-of-friends", "random"];

export const ALGORITHM_FEED_NAME_SET = new Set<string>(ALGORITHM_IDS);
