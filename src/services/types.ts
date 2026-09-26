export interface IAuthService {
  readonly currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChanged(
    callback: (
      user: { uid: string; email: string | null; displayName: string | null } | null,
    ) => void,
  ): () => void;
  getIdToken(): Promise<string>;
}

export interface SourceWeights {
  following: number;
  networkLikes: number;
  authorsTopics: number;
  popular: number;
  llm: number;
}

export interface Preferences {
  sourceWeights: SourceWeights;
  freshness: number; // 0-5; default 5 (7 days)
  politics: number; // 0-2; default 1 (neutral)
  purpose: number; // 0.2-0.8
}

export type FeedPreferences = Partial<Preferences>;

export interface LlmPrompt {
  promptKey: string;
  prompt: string;
  createdAt: string;
}

// What the api says about the prompt feature for this account: off (the llm-cg
// feature flag is not on for them), or on with the fitted prompt if any.
export type LlmPromptStatus = { enabled: false } | { enabled: true; prompt: LlmPrompt | null };

export interface FeedPreviewSession {
  requestId: string;
  feedName: import("../constants/algorithms").AlgorithmId;
  generatedAt: string;
  expiresAt: string;
}

export interface AcceptedFeedPreview {
  requestId: string;
  preferences: FeedPreferences;
  acceptedUntil: string | null;
}

export class FeedApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FeedApiError";
  }
}

export type FeedPreferencesByFeed = Partial<
  Record<import("../constants/algorithms").AlgorithmId, FeedPreferences>
>;

export interface IFeedApiService {
  listFeeds(): Promise<import("../models/feed-debug-snapshot").FeedListResponse>;
  getFeedDetail(
    requestId: string,
  ): Promise<import("../models/feed-debug-snapshot").FeedDetailResponse>;
  createFeedPreview(
    feedName: import("../constants/algorithms").AlgorithmId,
    prefs: FeedPreferences,
  ): Promise<FeedPreviewSession>;
  getFeedPreview(
    requestId: string,
  ): Promise<import("../models/feed-debug-snapshot").FeedDetailResponse>;
  acceptFeedPreview(
    feedName: import("../constants/algorithms").AlgorithmId,
    requestId: string,
    prefs: FeedPreferences,
    displayedItemUris: string[],
  ): Promise<AcceptedFeedPreview>;
  markSettingsVisited(): Promise<void>;
  getPreferences(): Promise<FeedPreferencesByFeed>;
  patchPreferences(
    feedName: import("../constants/algorithms").AlgorithmId,
    prefs: FeedPreferences,
  ): Promise<FeedPreferences>;
  getLlmPrompt(): Promise<LlmPromptStatus>;
  fitLlmPrompt(prompt: string): Promise<LlmPrompt>;
}
