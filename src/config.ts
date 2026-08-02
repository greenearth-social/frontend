export interface BlueskyUrls {
  "your-feed": string;
  "best-of-friends": string;
  random: string;
}

export const runtimeConfig = {
  blueskyUrls: {
    "your-feed": "https://bsky.app/profile/greenearth-social.bsky.social/feed/your-feed",
    "best-of-friends": "https://bsky.app/profile/greenearth-social.bsky.social/feed/best-of-friends",
    random: "https://bsky.app/profile/greenearth-social.bsky.social/feed/random",
  } satisfies BlueskyUrls,
};
