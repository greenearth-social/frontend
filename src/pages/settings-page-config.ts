export const LIFECYCLE_ICONS = [
  "/assets/slider/Eggs-slider.png",
  "/assets/slider/Caterpillar-slider.png",
  "/assets/slider/chrysalis-slider.png",
  "/assets/slider/emerging-slider.png",
  "/assets/slider/butterfly-slider.png",
];

export const UNLOCKED_ICON_PATH =
  "M416 160C416 124.7 444.7 96 480 96C515.3 96 544 124.7 544 160L544 192C544 209.7 558.3 224 576 224C593.7 224 608 209.7 608 192L608 160C608 89.3 550.7 32 480 32C409.3 32 352 89.3 352 160L352 224L192 224C156.7 224 128 252.7 128 288L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 288C512 252.7 483.3 224 448 224L416 224L416 160z";

export const LOCKED_ICON_PATH =
  "M256 160L256 224L384 224L384 160C384 124.7 355.3 96 320 96C284.7 96 256 124.7 256 160zM192 224L192 160C192 89.3 249.3 32 320 32C390.7 32 448 89.3 448 160L448 224C483.3 224 512 252.7 512 288L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 288C128 252.7 156.7 224 192 224z";

export type SettingsNodeType = "source" | "signal" | "penalty" | "config";

export interface SettingsNode {
  label: string;
  type: SettingsNodeType;
  description: string;
}

export const SETTINGS_NODES: Record<string, SettingsNode> = {
  sources: {
    label: "Sources",
    type: "config",
    description:
      "Percentages control how much each source contributes to the candidate pool. The lifecycle icons provide a visual scale from lower to higher emphasis. Changing one percentage rebalances the others unless a source is locked.",
  },
  time_window: {
    label: "Time Window",
    type: "config",
    description:
      "Defines the lookback period for candidate posts. Only posts within this window are considered for the feed.",
  },
  following: {
    label: "Following",
    type: "source",
    description: "Posts from accounts you follow. Weighted to balance familiarity with discovery.",
  },
  network_likes: {
    label: "Liked by Following",
    type: "source",
    description:
      "Posts liked by accounts you follow. Posts liked by more people in your network receive a stronger candidate score.",
  },
  authors_topics: {
    label: "Liked Authors/Topics",
    type: "source",
    description:
      "Posts from authors and topics you've expressed interest in, even if you don't follow them directly.",
  },
  popular: {
    label: "Popular",
    type: "source",
    description: "Trending posts across the network that are gaining rapid engagement.",
  },
  random: {
    label: "Random",
    type: "source",
    description: "A random selection of recent posts from across the community.",
  },
  predict_like: {
    label: "Engaging",
    type: "signal",
    description:
      "An ML model predicts the probability you'll like a post based on your historical behavior.",
  },
  constructiveness: {
    label: "Constructive",
    type: "signal",
    description:
      "Google's Perspective Bridging API scores how constructive and healthy a post's content is.",
  },
  repeated_author: {
    label: "Repeated author penalty",
    type: "penalty",
    description:
      "Reduces ranking of posts from authors who already appear multiple times in your feed, promoting diversity.",
  },
  repeated_topic: {
    label: "Repeated topic penalty",
    type: "penalty",
    description:
      "Reduces ranking of posts on topics you've already seen recently, ensuring topic variety.",
  },
  politics: {
    label: "Politics",
    type: "config",
    description:
      "Controls the score multiplier applied to political content. 1.00 is neutral; lower values reduce scores and higher values increase them.",
  },
};

export function formatWeight(value: number): string {
  return value.toFixed(2);
}
