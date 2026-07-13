import type { IFeedApiService } from "../types";
import type { FeedListResponse, FeedDetailResponse } from "../../models/feed-debug-snapshot";

export class FeedApiService implements IFeedApiService {
  constructor(
    private baseUrl: string,
    private getAuthToken: () => Promise<string>,
  ) {}

  async listFeeds(): Promise<FeedListResponse> {
    return this._fetch<FeedListResponse>("/api/feeds");
  }

  async getFeedDetail(requestId: string): Promise<FeedDetailResponse> {
    return this._fetch<FeedDetailResponse>(`/api/feeds/${requestId}`);
  }

  private async _fetch<T>(path: string): Promise<T> {
    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "unknown error");
      throw new Error(`API ${String(res.status)}: ${body}`);
    }
    return res.json() as Promise<T>;
  }
}
