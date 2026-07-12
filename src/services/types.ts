import type { FeedDebugDocument } from "../models/feed-debug-snapshot";

export interface HydratedPostResult {
  text: string;
  authorHandle: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  imageUrls: string[];
  videoUrl: string | null;
  linkCard: {
    title: string;
    description: string;
    imageUrl: string;
  } | null;
}

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
  hydratePosts(uris: string[]): Promise<Map<string, HydratedPostResult>>;
}
