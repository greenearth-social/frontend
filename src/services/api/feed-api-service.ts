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

  async getPreferences(): Promise<{ socialRadius: number }> {
    return this._fetch<{ socialRadius: number }>("/api/feeds/preferences");
  }

  async putPreferences(socialRadius: number): Promise<{ socialRadius: number }> {
    return this._fetch<{ socialRadius: number }>("/api/feeds/preferences", {
      method: "PUT",
      body: JSON.stringify({ socialRadius }),
      headers: { "Content-Type": "application/json" },
    });
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
