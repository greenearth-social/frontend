import type {
  AcceptedFeedPreview,
  FeedPreferences,
  FeedPreferencesByFeed,
  FeedPreviewSession,
  IFeedApiService,
} from "../types";
import { FeedApiError } from "../types";
import { canonicalAlgorithmId, isAlgorithmId, type AlgorithmId } from "../../constants/algorithms";
import type {
  ApiFeedItem,
  FeedDetailResponse,
  FeedListResponse,
} from "../../models/feed-debug-snapshot";

interface ApiPreferences {
  source_weights?: {
    following: number;
    network_likes?: number;
    authors_topics: number;
    popular: number;
  };
  freshness?: number;
  politics?: number;
  purpose?: number;
}

interface ApiPreferencesResponse {
  feeds: Record<string, ApiPreferences>;
}

interface ApiFeedSummary {
  request_id: string;
  generated_at: string;
  feed_name: string;
  api_release_sha?: string | null;
  applied_social_radius?: number | null;
  generator_diagnostics?: Array<{
    name: string;
    weight: number;
    requested_count: number;
    returned_count: number;
    contributed_count: number;
    status: string;
    reason: string | null;
    mode: string;
  }>;
}

interface ApiFeedListResponse {
  feeds: ApiFeedSummary[];
}

interface ApiFeedItemResponse {
  at_uri: string;
  rank: number | null;
  rank_score: number | null;
  after_rank_position: number | null;
  author: {
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  created_at: string | null;
  content: string | null;
  generators: Array<{ name: string; score: number | null }>;
  model_scores: Array<{ name: string; weight: number; score: number }>;
  diversification: {
    relevance: number;
    score: number;
    author_penalty: number;
    content_penalty: number;
  } | null;
  media: {
    image_urls: string[];
    video_url: string | null;
    link_card_url: string | null;
    link_card_title: string | null;
    link_card_description: string | null;
    labels: string[];
  } | null;
  engagement: {
    reply_count: number;
    repost_count: number;
    like_count: number;
  } | null;
  post_url: string | null;
}

interface ApiFeedDetailResponse {
  request_id: string;
  generated_at: string;
  api_release_sha?: string | null;
  items: ApiFeedItemResponse[];
  stored_item_count?: number;
  displayed_item_count?: number;
  publicly_filtered_count?: number;
  unavailable_count?: number;
}

interface ApiFeedPreviewResponse {
  request_id: string;
  feed_name: string;
  generated_at: string;
  expires_at: string;
}

interface ApiAcceptedFeedPreviewResponse {
  request_id: string;
  preferences: ApiPreferences;
  accepted_until?: string | null;
}

function mapPreferences(prefs: ApiPreferences): FeedPreferences {
  const mapped: FeedPreferences = {};
  if (prefs.source_weights !== undefined) {
    mapped.sourceWeights = {
      following: prefs.source_weights.following,
      networkLikes: prefs.source_weights.network_likes ?? 0,
      authorsTopics: prefs.source_weights.authors_topics,
      popular: prefs.source_weights.popular,
    };
  }
  if (prefs.freshness !== undefined) mapped.freshness = prefs.freshness;
  if (prefs.politics !== undefined) mapped.politics = prefs.politics;
  if (prefs.purpose !== undefined) mapped.purpose = prefs.purpose;
  return mapped;
}

function serializePreferences(prefs: FeedPreferences): ApiPreferences {
  const serialized: ApiPreferences = {};
  if (prefs.sourceWeights !== undefined) {
    serialized.source_weights = {
      following: prefs.sourceWeights.following,
      network_likes: prefs.sourceWeights.networkLikes,
      authors_topics: prefs.sourceWeights.authorsTopics,
      popular: prefs.sourceWeights.popular,
    };
  }
  if (prefs.freshness !== undefined) serialized.freshness = prefs.freshness;
  if (prefs.politics !== undefined) serialized.politics = prefs.politics;
  if (prefs.purpose !== undefined) serialized.purpose = prefs.purpose;
  return serialized;
}

function mapFeedItem(item: ApiFeedItemResponse): ApiFeedItem {
  return {
    atUri: item.at_uri,
    rank: item.rank,
    rankScore: item.rank_score,
    afterRankPosition: item.after_rank_position,
    author: {
      handle: item.author?.handle ?? null,
      displayName: item.author?.display_name ?? null,
      avatarUrl: item.author?.avatar_url ?? null,
    },
    createdAt: item.created_at,
    content: item.content,
    generators: item.generators,
    modelScores: item.model_scores,
    diversification: item.diversification
      ? {
          relevance: item.diversification.relevance,
          score: item.diversification.score,
          authorPenalty: item.diversification.author_penalty,
          contentPenalty: item.diversification.content_penalty,
        }
      : null,
    media: item.media
      ? {
          imageUrls: item.media.image_urls,
          videoUrl: item.media.video_url,
          linkCardUrl: item.media.link_card_url,
          linkCardTitle: item.media.link_card_title,
          linkCardDescription: item.media.link_card_description,
          labels: item.media.labels,
        }
      : null,
    engagement: item.engagement
      ? {
          replyCount: item.engagement.reply_count,
          repostCount: item.engagement.repost_count,
          likeCount: item.engagement.like_count,
        }
      : null,
    postUrl: item.post_url,
  };
}

function mapFeedDetail(response: ApiFeedDetailResponse): FeedDetailResponse {
  return {
    requestId: response.request_id,
    generatedAt: response.generated_at,
    apiReleaseSha: response.api_release_sha ?? null,
    items: response.items.map(mapFeedItem),
    filteringCounts: {
      storedItemCount: response.stored_item_count ?? response.items.length,
      displayedItemCount: response.displayed_item_count ?? response.items.length,
      publiclyFilteredCount: response.publicly_filtered_count ?? 0,
      unavailableCount: response.unavailable_count ?? 0,
    },
  };
}

export class FeedApiService implements IFeedApiService {
  constructor(
    private baseUrl: string,
    private getAuthToken: () => Promise<string>,
  ) {}

  async listFeeds(): Promise<FeedListResponse> {
    const response = await this._fetch<ApiFeedListResponse>("/api/feeds");
    return {
      feeds: response.feeds.flatMap((feed) => {
        const feedName = canonicalAlgorithmId(feed.feed_name);
        if (feedName === null) return [];
        return [
          {
            requestId: feed.request_id,
            generatedAt: feed.generated_at,
            feedName,
            apiReleaseSha: feed.api_release_sha ?? null,
            appliedSocialRadius: feed.applied_social_radius ?? null,
            generatorDiagnostics: (feed.generator_diagnostics ?? []).map((diagnostic) => ({
              name: diagnostic.name,
              weight: diagnostic.weight,
              requestedCount: diagnostic.requested_count,
              returnedCount: diagnostic.returned_count,
              contributedCount: diagnostic.contributed_count,
              status: diagnostic.status,
              reason: diagnostic.reason,
              mode: diagnostic.mode,
            })),
          },
        ];
      }),
    };
  }

  async getFeedDetail(requestId: string): Promise<FeedDetailResponse> {
    const response = await this._fetch<ApiFeedDetailResponse>(`/api/feeds/${requestId}`);
    return mapFeedDetail(response);
  }

  async createFeedPreview(
    feedName: AlgorithmId,
    prefs: FeedPreferences,
  ): Promise<FeedPreviewSession> {
    const response = await this._fetch<ApiFeedPreviewResponse>(
      `/api/feeds/${encodeURIComponent(feedName)}/preview`,
      {
        method: "POST",
        body: JSON.stringify(serializePreferences(prefs)),
        headers: { "Content-Type": "application/json" },
      },
    );
    const mappedFeedName = canonicalAlgorithmId(response.feed_name);
    if (mappedFeedName === null) throw new Error("Preview returned an unknown feed");
    return {
      requestId: response.request_id,
      feedName: mappedFeedName,
      generatedAt: response.generated_at,
      expiresAt: response.expires_at,
    };
  }

  async getFeedPreview(requestId: string): Promise<FeedDetailResponse> {
    const response = await this._fetch<ApiFeedDetailResponse>(
      `/api/feeds/previews/${encodeURIComponent(requestId)}`,
    );
    return mapFeedDetail(response);
  }

  async acceptFeedPreview(
    feedName: AlgorithmId,
    requestId: string,
    prefs: FeedPreferences,
    displayedItemUris: string[],
  ): Promise<AcceptedFeedPreview> {
    const response = await this._fetch<ApiAcceptedFeedPreviewResponse>(
      `/api/feeds/${encodeURIComponent(feedName)}/previews/${encodeURIComponent(requestId)}/accept`,
      {
        method: "POST",
        body: JSON.stringify({
          preferences: serializePreferences(prefs),
          displayed_item_uris: displayedItemUris,
        }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return {
      requestId: response.request_id,
      preferences: mapPreferences(response.preferences),
      acceptedUntil: response.accepted_until ?? null,
    };
  }

  async getPreferences(): Promise<FeedPreferencesByFeed> {
    const response = await this._fetch<ApiPreferencesResponse>("/api/feeds/preferences");
    const mapped: FeedPreferencesByFeed = {};
    for (const [feedName, preferences] of Object.entries(response.feeds)) {
      if (isAlgorithmId(feedName)) mapped[feedName] = mapPreferences(preferences);
    }
    return mapped;
  }

  async patchPreferences(feedName: AlgorithmId, prefs: FeedPreferences): Promise<FeedPreferences> {
    const response = await this._fetch<ApiPreferences>(
      `/api/feeds/preferences/${encodeURIComponent(feedName)}`,
      {
        method: "PATCH",
        body: JSON.stringify(serializePreferences(prefs)),
        headers: { "Content-Type": "application/json" },
      },
    );
    return mapPreferences(response);
  }

  private async _fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (init?.headers) {
      const extra = new Headers(init.headers);
      extra.forEach((value, key) => {
        headers[key] = value;
      });
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "unknown error");
      throw new FeedApiError(res.status, `API ${String(res.status)}: ${body}`);
    }
    return res.json() as Promise<T>;
  }
}
