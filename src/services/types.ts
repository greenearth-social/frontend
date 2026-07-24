export interface IAuthService {
  readonly currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: { uid: string; email: string | null; displayName: string | null } | null) => void): () => void;
  getIdToken(): Promise<string>;
}

export interface Preferences {
  socialRadius: number;  // 0-4
  freshness: number;     // 0-5; default 5 (7 days)
  politics: number;      // 0.5-1.5
  purpose: number;       // 0.2-0.8
}

export interface IFeedApiService {
  listFeeds(): Promise<import("../models/feed-debug-snapshot").FeedListResponse>;
  getFeedDetail(requestId: string): Promise<import("../models/feed-debug-snapshot").FeedDetailResponse>;
  getPreferences(): Promise<Preferences>;
  putPreferences(prefs: Preferences): Promise<Preferences>;
}
