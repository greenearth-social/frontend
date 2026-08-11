export interface IAuthService {
  readonly currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: { uid: string; email: string | null; displayName: string | null } | null) => void): () => void;
  getIdToken(): Promise<string>;
}

export interface SourceWeights {
  following: number;
  networkLikes: number;
  authorsTopics: number;
  popular: number;
}

export interface Preferences {
  sourceWeights: SourceWeights;
  freshness: number; // 0-5; default 5 (7 days)
  politics: number; // 0.5-1.5; frontend-only placeholder
  purpose: number; // 0.2-0.8
}

export type FeedPreferences = Partial<Preferences>;

export type FeedPreferencesByFeed = Partial<
  Record<import("../constants/algorithms").AlgorithmId, FeedPreferences>
>;

export interface IFeedApiService {
  listFeeds(): Promise<import("../models/feed-debug-snapshot").FeedListResponse>;
  getFeedDetail(requestId: string): Promise<import("../models/feed-debug-snapshot").FeedDetailResponse>;
  getPreferences(): Promise<FeedPreferencesByFeed>;
  patchPreferences(
    feedName: import("../constants/algorithms").AlgorithmId,
    prefs: FeedPreferences,
  ): Promise<FeedPreferences>;
}
