export interface BlueskyUrls {
  "your-feed": string;
  "best-of-friends": string;
  random: string;
}

export const runtimeConfig = {
  blueskyUrls: {
    "your-feed": "https://bsky.app/profile/did:plc:wrmpulygwvuhjn2c3jbalgqj/feed/a0-yf",
    "best-of-friends": "https://bsky.app/profile/did:plc:wrmpulygwvuhjn2c3jbalgqj/feed/fd-bof",
    random: "https://bsky.app/profile/did:plc:wrmpulygwvuhjn2c3jbalgqj/feed/67-r",
  } as BlueskyUrls,
};
