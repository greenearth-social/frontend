import type { IFeedApiService, Preferences } from "../types";
import type {
  ApiFeedItem,
  FeedDetailResponse,
  FeedListResponse,
} from "../../models/feed-debug-snapshot";

interface ApiPreferences {
  social_radius: number;
  freshness: number;
  politics: number;
  purpose: number;
}

interface ApiFeedSummary {
  request_id: string;
  generated_at: string;
  feed_name: string;
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
  items: ApiFeedItemResponse[];
}

function mapPreferences(prefs: ApiPreferences): Preferences {
  return {
    socialRadius: prefs.social_radius,
    freshness: prefs.freshness,
    politics: prefs.politics,
    purpose: prefs.purpose,
  };
}

function serializePreferences(prefs: Preferences): ApiPreferences {
  return {
    social_radius: prefs.socialRadius,
    freshness: prefs.freshness,
    politics: prefs.politics,
    purpose: prefs.purpose,
  };
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

export class FeedApiService implements IFeedApiService {
  constructor(
    private baseUrl: string,
    private getAuthToken: () => Promise<string>,
  ) {}

  async listFeeds(): Promise<FeedListResponse> {
    const response = await this._fetch<ApiFeedListResponse>("/api/feeds");
    return {
      feeds: response.feeds.map((feed) => ({
        requestId: feed.request_id,
        generatedAt: feed.generated_at,
        feedName: feed.feed_name,
      })),
    };
  }

  async getFeedDetail(requestId: string): Promise<FeedDetailResponse> {
    const response = await this._fetch<ApiFeedDetailResponse>(`/api/feeds/${requestId}`);
    return {
      requestId: response.request_id,
      generatedAt: response.generated_at,
      items: response.items.map(mapFeedItem),
    };
  }

  async getPreferences(): Promise<Preferences> {
    return mapPreferences(await this._fetch<ApiPreferences>("/api/feeds/preferences"));
  }

  async putPreferences(prefs: Preferences): Promise<Preferences> {
    const response = await this._fetch<ApiPreferences>("/api/feeds/preferences", {
      method: "PUT",
      body: JSON.stringify(serializePreferences(prefs)),
      headers: { "Content-Type": "application/json" },
    });
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
      throw new Error(`API ${String(res.status)}: ${body}`);
    }
    return res.json() as Promise<T>;
  }
}
