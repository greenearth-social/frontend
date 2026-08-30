import type { FeedPreferences, IFeedApiService } from "../types";
import type { FeedListResponse, FeedDetailResponse } from "../../models/feed-debug-snapshot";

const MOCK_FEED_DETAIL: FeedDetailResponse = {
  requestId: "abc123-def456-ghi789",
  generatedAt: "2026-07-07T12:00:00Z",
  apiReleaseSha: "preview-api-sha",
  items: [
    {
      atUri: "at://did:plc:author1/app.bsky.feed.post/post1",
      rank: 1,
      rankScore: 0.91,
      afterRankPosition: 1,
      author: { handle: "alice.bsky.social", displayName: "Alice Chen", avatarUrl: null },
      createdAt: "2026-07-07T11:55:00Z",
      content: "Post one from two_tower",
      generators: [
        { name: "two_tower", score: 0.85 },
        { name: "followed_users", score: 0.9 },
      ],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.85 },
        { name: "perspective", weight: 0.4, score: 0.95 },
      ],
      diversification: {
        relevance: 0.91,
        score: 0.273,
        authorPenalty: 0.0,
        contentPenalty: 0.0,
      },
      media: {
        imageUrls: [
          "https://picsum.photos/seed/post1a/600/400",
          "https://picsum.photos/seed/post1b/600/400",
        ],
        videoUrl: null,
        linkCardUrl: null,
        linkCardTitle: null,
        linkCardDescription: null,
        labels: ["2 images"],
      },
      engagement: { replyCount: 5, repostCount: 12, likeCount: 47 },
      postUrl: "https://bsky.app/profile/did:plc:author1/post/post1",
    },
    {
      atUri: "at://did:plc:author3/app.bsky.feed.post/post3",
      rank: 3,
      rankScore: 0.65,
      afterRankPosition: 3,
      author: { handle: "carol.bsky.social", displayName: "Carol Zhang", avatarUrl: null },
      createdAt: "2026-07-07T11:45:00Z",
      content: "Post three from two_tower",
      generators: [
        { name: "two_tower", score: 0.64 },
        { name: "followed_users", score: 0.78 },
      ],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.64 },
        { name: "perspective", weight: 0.4, score: 0.6 },
      ],
      diversification: {
        relevance: 0.65,
        score: 0.195,
        authorPenalty: 0.0,
        contentPenalty: 0.0,
      },
      media: {
        imageUrls: [],
        videoUrl: "https://example.com/video.mp4",
        linkCardUrl: null,
        linkCardTitle: null,
        linkCardDescription: null,
        labels: ["video"],
      },
      engagement: { replyCount: 2, repostCount: 5, likeCount: 23 },
      postUrl: "https://bsky.app/profile/did:plc:author3/post/post3",
    },
    {
      atUri: "at://did:plc:author5/app.bsky.feed.post/post6",
      rank: 2,
      rankScore: 0.78,
      afterRankPosition: 2,
      author: { handle: "eve.bsky.social", displayName: "Eve Johnson", avatarUrl: null },
      createdAt: "2026-07-07T11:40:00Z",
      content: "Post six from followed user",
      generators: [{ name: "followed_users", score: 0.88 }],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.72 },
        { name: "perspective", weight: 0.4, score: 0.82 },
      ],
      diversification: {
        relevance: 0.78,
        score: 0.234,
        authorPenalty: 0.0,
        contentPenalty: 0.0,
      },
      media: {
        imageUrls: [],
        videoUrl: null,
        linkCardUrl: null,
        linkCardTitle: null,
        linkCardDescription: null,
        labels: [],
      },
      engagement: { replyCount: 0, repostCount: 2, likeCount: 15 },
      postUrl: "https://bsky.app/profile/did:plc:author5/post/post6",
    },
    {
      atUri: "at://did:plc:author2/app.bsky.feed.post/post2",
      rank: 4,
      rankScore: 0.52,
      afterRankPosition: 4,
      author: { handle: "bob.bsky.social", displayName: "Bob Rivera", avatarUrl: null },
      createdAt: "2026-07-07T11:35:00Z",
      content: "Post two from two_tower",
      generators: [
        { name: "two_tower", score: 0.72 },
        { name: "followed_users", score: 0.65 },
      ],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.45 },
        { name: "perspective", weight: 0.4, score: 0.55 },
      ],
      diversification: {
        relevance: 0.52,
        score: 0.156,
        authorPenalty: 0.0,
        contentPenalty: 0.0,
      },
      media: {
        imageUrls: [],
        videoUrl: null,
        linkCardUrl: "https://example.com/article",
        linkCardTitle: "Algorithmic Transparency Report",
        linkCardDescription:
          "New research reveals how social media algorithms rank content in users feeds.",
        labels: ["link"],
      },
      engagement: { replyCount: 8, repostCount: 20, likeCount: 91 },
      postUrl: "https://bsky.app/profile/did:plc:author2/post/post2",
    },
    {
      atUri: "at://did:plc:author4/app.bsky.feed.post/post4",
      rank: 5,
      rankScore: 0.48,
      afterRankPosition: 5,
      author: { handle: "dave.bsky.social", displayName: "Dave Kim", avatarUrl: null },
      createdAt: "2026-07-07T11:30:00Z",
      content: "Post four from two_tower",
      generators: [{ name: "two_tower", score: 0.55 }],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.55 },
        { name: "perspective", weight: 0.4, score: 0.3 },
      ],
      diversification: {
        relevance: 0.48,
        score: 0.144,
        authorPenalty: 0.0,
        contentPenalty: 0.0,
      },
      media: {
        imageUrls: [],
        videoUrl: null,
        linkCardUrl: null,
        linkCardTitle: null,
        linkCardDescription: null,
        labels: [],
      },
      engagement: { replyCount: 1, repostCount: 0, likeCount: 7 },
      postUrl: "https://bsky.app/profile/did:plc:author4/post/post4",
    },
    {
      atUri: "at://did:plc:author1/app.bsky.feed.post/post5",
      rank: 6,
      rankScore: 0.35,
      afterRankPosition: 6,
      author: { handle: "alice.bsky.social", displayName: "Alice Chen", avatarUrl: null },
      createdAt: "2026-07-07T11:25:00Z",
      content: "Post five (same author as post1)",
      generators: [{ name: "two_tower", score: 0.5 }],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.4 },
        { name: "perspective", weight: 0.4, score: 0.25 },
      ],
      diversification: {
        relevance: 0.35,
        score: -0.045,
        authorPenalty: 0.15,
        contentPenalty: 0.0,
      },
      media: {
        imageUrls: [],
        videoUrl: null,
        linkCardUrl: null,
        linkCardTitle: null,
        linkCardDescription: null,
        labels: [],
      },
      engagement: { replyCount: 3, repostCount: 1, likeCount: 12 },
      postUrl: "https://bsky.app/profile/did:plc:author1/post/post5",
    },
  ],
  filteringCounts: {
    storedItemCount: 6,
    displayedItemCount: 6,
    publiclyFilteredCount: 0,
    unavailableCount: 0,
  },
};

export class MockFeedApiService implements IFeedApiService {
  private previewPreferences = new Map<string, FeedPreferences>();
  private previewSequence = 0;

  listFeeds(): Promise<FeedListResponse> {
    return Promise.resolve({
      feeds: [
        {
          requestId: "abc123-def456-ghi789",
          generatedAt: new Date().toISOString(),
          feedName: "your-feed",
          apiReleaseSha: "preview-api-sha",
          appliedSocialRadius: 2,
          generatorDiagnostics: [],
        },
      ],
    });
  }

  getFeedDetail(_requestId: string): Promise<FeedDetailResponse> {
    return Promise.resolve(MOCK_FEED_DETAIL);
  }

  createFeedPreview(
    feedName: import("../../constants/algorithms").AlgorithmId,
    prefs: FeedPreferences,
  ): Promise<import("../types").FeedPreviewSession> {
    const generatedAt = new Date().toISOString();
    const requestId = `preview-${String(Date.now())}-${String(++this.previewSequence)}`;
    this.previewPreferences.set(requestId, prefs);
    return Promise.resolve({
      requestId,
      feedName,
      generatedAt,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  }

  async getFeedPreview(_requestId: string): Promise<FeedDetailResponse> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const preferences = this.previewPreferences.get(_requestId);
    if (preferences?.freshness === 5) {
      return {
        ...MOCK_FEED_DETAIL,
        requestId: _requestId,
        generatedAt: new Date().toISOString(),
      };
    }
    const items = [...(MOCK_FEED_DETAIL.items ?? [])];
    const newItem = items[3]
      ? {
          ...items[3],
          atUri: "at://did:plc:new-author/app.bsky.feed.post/preview-new",
          rank: 3,
          author: {
            handle: "new-author.bsky.social",
            displayName: "New for this preview",
            avatarUrl: null,
          },
          content: "A newly eligible post appears after applying this draft.",
          generators: [{ name: "popularity", score: 0.74 }],
        }
      : undefined;
    const reordered = [items[2], items[0], newItem, items[4], items[1], items[5]].filter(
      (item): item is NonNullable<typeof item> => item !== undefined,
    );
    const additionalItems = Array.from({ length: 39 }, (_, index) => {
      const template = items[index % items.length];
      if (!template) throw new Error("Mock preview requires at least one template post");
      return {
        ...template,
        atUri: `at://did:plc:preview-${String(index)}/app.bsky.feed.post/extra-${String(index)}`,
        author: {
          ...template.author,
          handle: `preview-${String(index)}.test`,
          displayName: `Preview author ${String(index + 1)}`,
        },
        content: `Additional full-slate preview post ${String(index + 1)}`,
      };
    });
    const previewItems = [...reordered, ...additionalItems].map((item, index) => ({
      ...item,
      rank: index + 1,
      afterRankPosition: index + 1,
    }));
    return {
      ...MOCK_FEED_DETAIL,
      requestId: _requestId,
      generatedAt: new Date().toISOString(),
      items: previewItems,
      filteringCounts: {
        storedItemCount: 48,
        displayedItemCount: previewItems.length,
        publiclyFilteredCount: 1,
        unavailableCount: 2,
      },
    };
  }

  acceptFeedPreview(
    _feedName: import("../../constants/algorithms").AlgorithmId,
    requestId: string,
    prefs: FeedPreferences,
    _displayedItemUris: string[],
  ): Promise<import("../types").AcceptedFeedPreview> {
    if (!this.previewPreferences.has(requestId)) {
      return Promise.reject(new Error("Mock preview expired"));
    }
    return Promise.resolve({
      requestId,
      preferences: prefs,
      acceptedUntil: null,
    });
  }

  getPreferences(): Promise<import("../types").FeedPreferencesByFeed> {
    return Promise.resolve({
      "your-feed": {
        sourceWeights: {
          following: 0.3,
          networkLikes: 0.2,
          authorsTopics: 0.25,
          popular: 0.25,
        },
        freshness: 5,
        purpose: 0.5,
      },
      "best-of-friends": { freshness: 5, purpose: 0.5 },
      random: { freshness: 5 },
    });
  }

  patchPreferences(
    _feedName: import("../../constants/algorithms").AlgorithmId,
    prefs: import("../types").FeedPreferences,
  ): Promise<import("../types").FeedPreferences> {
    return Promise.resolve(prefs);
  }
}
