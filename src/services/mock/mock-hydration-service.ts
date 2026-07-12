import type { IHydrationService, HydratedPostResult } from "../types";

const MOCK_AUTHORS: Record<string, { displayName: string; handle: string; avatarUrl: string | null }> = {
  "did:plc:author1": { displayName: "Alice Chen", handle: "alice.bsky.social", avatarUrl: null },
  "did:plc:author2": { displayName: "Bob Rivera", handle: "bob.bsky.social", avatarUrl: null },
  "did:plc:author3": { displayName: "Carol Zhang", handle: "carol.bsky.social", avatarUrl: null },
  "did:plc:author4": { displayName: "Dave Kim", handle: "dave.bsky.social", avatarUrl: null },
  "did:plc:author5": { displayName: "Eve Johnson", handle: "eve.bsky.social", avatarUrl: null },
};

function extractDid(uri: string): string | null {
  const match = uri.match(/at:\/\/(did:plc:[^/]+)\//);
  return match?.[1] ?? null;
}

export class MockHydrationService implements IHydrationService {
  async hydratePosts(uris: string[]): Promise<Map<string, HydratedPostResult>> {
    await new Promise((r) => setTimeout(r, 200));
    const map = new Map<string, HydratedPostResult>();

    const baseTime = new Date("2026-07-10T12:00:00Z").getTime();

    uris.forEach((uri, index) => {
      const did = extractDid(uri);
      const author = MOCK_AUTHORS[did ?? ""] ?? {
        displayName: "Unknown Author",
        handle: "unknown.bsky.social",
        avatarUrl: null,
      };

      const minutesAgo = (index + 1) * 7 + index * 3;
      const createdAt = new Date(baseTime - minutesAgo * 60 * 1000).toISOString();

      const hasImage = uri.includes("post1");
      const hasLink = uri.includes("post2") || uri.includes("article");
      const hasVideo = uri.includes("post3");

      map.set(uri, {
        text: `This is the hydrated text for ${uri}. Fascinating observations about the state of social media and algorithmic curation.`,
        authorHandle: author.handle,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        createdAt,
        replyCount: Math.floor(Math.random() * 50),
        repostCount: Math.floor(Math.random() * 30),
        likeCount: Math.floor(Math.random() * 200),
        imageUrls: hasImage
          ? [
              "https://picsum.photos/seed/" + uri.replace(/[^a-zA-Z0-9]/g, "") + "1/600/400",
              "https://picsum.photos/seed/" + uri.replace(/[^a-zA-Z0-9]/g, "") + "2/600/400",
            ]
          : [],
        videoUrl: hasVideo ? "https://example.com/video.mp4" : null,
        linkCard: hasLink
          ? {
              title: "How Algorithmic Curation Shapes What We See",
              description: "A deep dive into recommendation systems and their impact on online discourse.",
              imageUrl: "https://picsum.photos/seed/linkcard/800/400",
            }
          : null,
      });
    });

    return map;
  }
}
