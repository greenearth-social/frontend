import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedApiService } from "../services/api/feed-api-service";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("FeedApiService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps feed summaries from snake_case", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          feeds: [
            {
              request_id: "req-1",
              generated_at: "2026-07-15T12:00:00Z",
              feed_name: "your-feed",
              applied_social_radius: 0,
              generator_diagnostics: [
                {
                  name: "followed_users",
                  weight: 0.7,
                  requested_count: 70,
                  returned_count: 20,
                  contributed_count: 8,
                  status: "success",
                  reason: null,
                  mode: "primary",
                },
              ],
            },
          ],
        }),
      ),
    );
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await expect(service.listFeeds()).resolves.toEqual({
      feeds: [
        {
          requestId: "req-1",
          generatedAt: "2026-07-15T12:00:00Z",
          feedName: "your-feed",
          appliedSocialRadius: 0,
          generatorDiagnostics: [
            {
              name: "followed_users",
              weight: 0.7,
              requestedCount: 70,
              returnedCount: 20,
              contributedCount: 8,
              status: "success",
              reason: null,
              mode: "primary",
            },
          ],
        },
      ],
    });
  });

  it("maps nested feed details from snake_case", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          request_id: "req-1",
          generated_at: "2026-07-15T12:00:00Z",
          items: [
            {
              at_uri: "at://post/1",
              rank: 1,
              rank_score: 0.9,
              after_rank_position: 2,
              author: { handle: "alice.test", display_name: "Alice", avatar_url: null },
              created_at: null,
              content: "hello",
              generators: [{ name: "two_tower", score: 0.8 }],
              model_scores: [{ name: "ranker", weight: 1, score: 0.9 }],
              diversification: {
                relevance: 0.9,
                score: 0.8,
                author_penalty: 0.1,
                content_penalty: 0.2,
              },
              media: {
                image_urls: ["https://example.com/image.jpg"],
                video_url: null,
                link_card_url: null,
                link_card_title: null,
                link_card_description: null,
                labels: ["image"],
              },
              engagement: { reply_count: 1, repost_count: 2, like_count: 3 },
              post_url: "https://bsky.app/post/1",
            },
          ],
        }),
      ),
    );
    const service = new FeedApiService("", () => Promise.resolve("token"));

    const response = await service.getFeedDetail("req-1");

    expect(response.requestId).toBe("req-1");
    expect(response.items?.[0]).toMatchObject({
      atUri: "at://post/1",
      rankScore: 0.9,
      afterRankPosition: 2,
      author: { displayName: "Alice", avatarUrl: null },
      modelScores: [{ name: "ranker", weight: 1, score: 0.9 }],
      diversification: { authorPenalty: 0.1, contentPenalty: 0.2 },
      media: { imageUrls: ["https://example.com/image.jpg"] },
      engagement: { replyCount: 1, repostCount: 2, likeCount: 3 },
      postUrl: "https://bsky.app/post/1",
    });
  });

  it("maps preference responses from snake_case", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ social_radius: 3, freshness: 4, politics: 1.25, purpose: 0.65 }),
      ),
    );
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await expect(service.getPreferences()).resolves.toEqual({
      socialRadius: 3,
      freshness: 4,
      politics: 1.25,
      purpose: 0.65,
    });
  });

  it("serializes preference updates as snake_case", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ social_radius: 1, freshness: 2, politics: 1, purpose: 0.5 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await service.putPreferences({
      socialRadius: 1,
      freshness: 2,
      politics: 1,
      purpose: 0.5,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      social_radius: 1,
      freshness: 2,
      politics: 1,
      purpose: 0.5,
    });
  });
});
