import type { IFeedApiService } from "../types";
import type { FeedListResponse, FeedDetailResponse } from "../../models/feed-debug-snapshot";

const MOCK_FEED_DETAIL: FeedDetailResponse = {
  requestId: "abc123-def456-ghi789",
  generatedAt: "2026-07-07T12:00:00Z",
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
        { name: "followed_users", score: 0.90 },
      ],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.85 },
        { name: "perspective", weight: 0.4, score: 0.95 },
      ],
      diversification: { relevance: 0.91, score: 0.91, authorPenalty: 0.0, contentPenalty: 0.0 },
      media: { imageUrls: ["https://picsum.photos/seed/post1a/600/400", "https://picsum.photos/seed/post1b/600/400"], videoUrl: null, linkCardUrl: null, linkCardTitle: null, linkCardDescription: null, labels: ["2 images"] },
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
        { name: "perspective", weight: 0.4, score: 0.60 },
      ],
      diversification: { relevance: 0.65, score: 0.65, authorPenalty: 0.0, contentPenalty: 0.0 },
      media: { imageUrls: [], videoUrl: "https://example.com/video.mp4", linkCardUrl: null, linkCardTitle: null, linkCardDescription: null, labels: ["video"] },
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
      generators: [
        { name: "followed_users", score: 0.88 },
      ],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.72 },
        { name: "perspective", weight: 0.4, score: 0.82 },
      ],
      diversification: { relevance: 0.78, score: 0.78, authorPenalty: 0.0, contentPenalty: 0.0 },
      media: { imageUrls: [], videoUrl: null, linkCardUrl: null, linkCardTitle: null, linkCardDescription: null, labels: [] },
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
      diversification: { relevance: 0.52, score: 0.52, authorPenalty: 0.0, contentPenalty: 0.0 },
      media: { imageUrls: [], videoUrl: null, linkCardUrl: "https://example.com/article", linkCardTitle: "Algorithmic Transparency Report", linkCardDescription: "New research reveals how social media algorithms rank content in users feeds.", labels: ["link"] },
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
      generators: [
        { name: "two_tower", score: 0.55 },
      ],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.55 },
        { name: "perspective", weight: 0.4, score: 0.30 },
      ],
      diversification: { relevance: 0.48, score: 0.48, authorPenalty: 0.0, contentPenalty: 0.0 },
      media: { imageUrls: [], videoUrl: null, linkCardUrl: null, linkCardTitle: null, linkCardDescription: null, labels: [] },
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
      generators: [
        { name: "two_tower", score: 0.50 },
      ],
      modelScores: [
        { name: "heavy_ranker", weight: 0.6, score: 0.40 },
        { name: "perspective", weight: 0.4, score: 0.25 },
      ],
      diversification: { relevance: 0.35, score: 0.35, authorPenalty: -0.15, contentPenalty: 0.0 },
      media: { imageUrls: [], videoUrl: null, linkCardUrl: null, linkCardTitle: null, linkCardDescription: null, labels: [] },
      engagement: { replyCount: 3, repostCount: 1, likeCount: 12 },
      postUrl: "https://bsky.app/profile/did:plc:author1/post/post5",
    },
  ],
};

export class MockFeedApiService implements IFeedApiService {
  listFeeds(): Promise<FeedListResponse> {
    return Promise.resolve({
      feeds: [
        { requestId: "abc123-def456-ghi789", generatedAt: new Date().toISOString(), feedName: "your-feed" },
      ],
    });
  }

  getFeedDetail(_requestId: string): Promise<FeedDetailResponse> {
    return Promise.resolve(MOCK_FEED_DETAIL);
  }

  getPreferences(): Promise<{ socialRadius: number }> {
    return Promise.resolve({ socialRadius: 2 });
  }

  putPreferences(socialRadius: number): Promise<{ socialRadius: number }> {
    return Promise.resolve({ socialRadius });
  }
}
