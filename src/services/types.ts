export interface IAuthService {
  readonly currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: { uid: string; email: string | null; displayName: string | null } | null) => void): () => void;
  getIdToken(): Promise<string>;
}

export interface IFeedApiService {
  listFeeds(): Promise<import("../models/feed-debug-snapshot").FeedListResponse>;
  getFeedDetail(requestId: string): Promise<import("../models/feed-debug-snapshot").FeedDetailResponse>;
}
