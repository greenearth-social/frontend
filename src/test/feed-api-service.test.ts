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
              api_release_sha: "api-sha-summary",
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
          apiReleaseSha: "api-sha-summary",
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

  it("maps published Bluesky rkeys to their canonical feed pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          feeds: [
            { request_id: "green", generated_at: "2026-08-07T10:00:00Z", feed_name: "a0-yf" },
            { request_id: "friends", generated_at: "2026-08-07T09:00:00Z", feed_name: "fd-bof" },
            { request_id: "random", generated_at: "2026-08-07T08:00:00Z", feed_name: "67-r" },
            { request_id: "internal", generated_at: "2026-08-07T07:00:00Z", feed_name: "op-tt" },
          ],
        }),
      ),
    );
    const service = new FeedApiService("", () => Promise.resolve("token"));

    const response = await service.listFeeds();

    expect(response.feeds?.map((feed) => [feed.requestId, feed.feedName])).toEqual([
      ["green", "your-feed"],
      ["friends", "best-of-friends"],
      ["random", "random"],
    ]);
  });

  it("maps nested feed details from snake_case", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          request_id: "req-1",
          generated_at: "2026-07-15T12:00:00Z",
          api_release_sha: "api-sha-detail",
          stored_item_count: 4,
          displayed_item_count: 1,
          publicly_filtered_count: 2,
          unavailable_count: 1,
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
    expect(response.apiReleaseSha).toBe("api-sha-detail");
    expect(response.filteringCounts).toEqual({
      storedItemCount: 4,
      displayedItemCount: 1,
      publiclyFilteredCount: 2,
      unavailableCount: 1,
      partialItemCount: 0,
    });
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
        jsonResponse({
          feeds: {
            "your-feed": {
              source_weights: {
                following: 0.3,
                network_likes: 0.2,
                authors_topics: 0.25,
                popular: 0.25,
              },
              freshness: 4,
              purpose: 0.65,
            },
            "best-of-friends": { freshness: 2, purpose: 0.35 },
            random: { freshness: 1 },
          },
        }),
      ),
    );
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await expect(service.getPreferences()).resolves.toEqual({
      "your-feed": {
        sourceWeights: {
          following: 0.3,
          networkLikes: 0.2,
          authorsTopics: 0.25,
          popular: 0.25,
        },
        freshness: 4,
        purpose: 0.65,
      },
      "best-of-friends": { freshness: 2, purpose: 0.35 },
      random: { freshness: 1 },
    });
  });

  it("maps legacy three-source preferences with no network likes weight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          feeds: {
            "your-feed": {
              source_weights: {
                following: 0.4,
                authors_topics: 0.3,
                popular: 0.3,
              },
            },
          },
        }),
      ),
    );
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await expect(service.getPreferences()).resolves.toMatchObject({
      "your-feed": {
        sourceWeights: {
          following: 0.4,
          networkLikes: 0,
          authorsTopics: 0.3,
          popular: 0.3,
        },
      },
    });
  });

  it("serializes preference updates as snake_case", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ freshness: 2 }));
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await service.patchPreferences("best-of-friends", { freshness: 2 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/feeds/preferences/best-of-friends");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ freshness: 2 });
  });

  it("serializes atomic source weights as snake_case", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        source_weights: {
          following: 0.4,
          network_likes: 0.2,
          authors_topics: 0.15,
          popular: 0.25,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await service.patchPreferences("your-feed", {
      sourceWeights: {
        following: 0.4,
        networkLikes: 0.2,
        authorsTopics: 0.15,
        popular: 0.25,
      },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      source_weights: {
        following: 0.4,
        network_likes: 0.2,
        authors_topics: 0.15,
        popular: 0.25,
      },
    });
  });

  it.each([
    {
      label: "Following",
      weights: { following: 1, networkLikes: 0, authorsTopics: 0, popular: 0 },
      wire: { following: 1, network_likes: 0, authors_topics: 0, popular: 0 },
    },
    {
      label: "Liked by Following",
      weights: { following: 0, networkLikes: 1, authorsTopics: 0, popular: 0 },
      wire: { following: 0, network_likes: 1, authors_topics: 0, popular: 0 },
    },
  ])("preserves every zero in a 100% $label preview payload", async ({ weights, wire }) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        request_id: "preview-100",
        feed_name: "your-feed",
        generated_at: "2026-08-23T12:00:00Z",
        expires_at: "2026-08-23T12:10:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await service.createFeedPreview("your-feed", { sourceWeights: weights });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ source_weights: wire });
  });

  it("creates a preview from a sparse draft without persisting it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        request_id: "preview-1",
        feed_name: "your-feed",
        generated_at: "2026-08-23T12:00:00Z",
        expires_at: "2026-08-23T12:10:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await expect(
      service.createFeedPreview("your-feed", { freshness: 2, purpose: 0.65 }),
    ).resolves.toEqual({
      requestId: "preview-1",
      feedName: "your-feed",
      generatedAt: "2026-08-23T12:00:00Z",
      expiresAt: "2026-08-23T12:10:00Z",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/feeds/your-feed/preview");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ freshness: 2, purpose: 0.65 });
  });

  it("sends an empty object when refreshing a saved-settings baseline", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        request_id: "preview-baseline",
        feed_name: "random",
        generated_at: "2026-08-23T12:00:00Z",
        expires_at: "2026-08-23T12:10:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await service.createFeedPreview("random", {});

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it("fetches preview details from the ownership-checked preview route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        request_id: "preview-1",
        generated_at: "2026-08-23T12:00:00Z",
        items: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    const detail = await service.getFeedPreview("preview-1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/feeds/previews/preview-1");
    expect(detail.requestId).toBe("preview-1");
    expect(detail.items).toEqual([]);
  });

  it("accepts a preview with its sparse draft and exact displayed URI order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        request_id: "preview-1",
        preferences: { freshness: 2, purpose: 0.65 },
        accepted_until: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new FeedApiService("", () => Promise.resolve("token"));

    await expect(
      service.acceptFeedPreview("your-feed", "preview-1", { freshness: 2, purpose: 0.65 }, [
        "at://post/2",
        "at://post/1",
      ]),
    ).resolves.toEqual({
      requestId: "preview-1",
      preferences: { freshness: 2, purpose: 0.65 },
      acceptedUntil: null,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/feeds/your-feed/previews/preview-1/accept");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      preferences: { freshness: 2, purpose: 0.65 },
      displayed_item_uris: ["at://post/2", "at://post/1"],
    });
  });
});
