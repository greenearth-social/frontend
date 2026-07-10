import type { FeedDebugDocument } from "../models/feed-debug-snapshot";

export interface IAuthService {
  readonly currentUser: { uid: string; email: string | null } | null;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: { uid: string; email: string | null } | null) => void): () => void;
}

export interface IFeedDebugService {
  loadLatestSnapshot(did: string): Promise<FeedDebugDocument | null>;
  triggerSnapshot(did: string): Promise<string | null>;
}

export interface IHydrationService {
  hydratePosts(
    uris: string[],
  ): Promise<Map<string, { text: string; authorHandle: string }>>;
}
