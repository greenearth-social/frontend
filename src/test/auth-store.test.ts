import { describe, expect, it, vi } from "vitest";
import type { IAuthService, Preferences } from "../services/types";
import { RootStore } from "../stores/root-store";

type User = IAuthService["currentUser"];

class TestAuthService implements IAuthService {
  currentUser: User = null;
  private listener: ((user: User) => void) | null = null;

  constructor(private emitImmediately = true) {}

  signInWithCustomToken(): Promise<void> {
    return Promise.resolve();
  }

  signOut(): Promise<void> {
    return Promise.resolve();
  }

  getIdToken(): Promise<string> {
    return Promise.resolve("token");
  }

  onAuthStateChanged(callback: (user: User) => void): () => void {
    this.listener = callback;
    if (this.emitImmediately) callback(this.currentUser);
    return () => {
      this.listener = null;
    };
  }

  emit(user: User): void {
    this.currentUser = user;
    this.listener?.(user);
  }
}

const preferences: Preferences = {
  sourceWeights: {
    following: 0.3,
    networkLikes: 0.2,
    authorsTopics: 0.25,
    popular: 0.25,
  },
  freshness: 5,
  politics: 1,
  purpose: 0.5,
};

describe("AuthStore account changes", () => {
  it("resets feed state once for each authenticated user change", () => {
    const authService = new TestAuthService();
    const root = new RootStore({
      authService,
      feedApiService: {
        listFeeds: vi.fn(),
        getFeedDetail: vi.fn(),
        getPreferences: vi.fn().mockResolvedValue({ "your-feed": preferences }),
        patchPreferences: vi.fn(),
      },
      analyticsService: {
        identify: vi.fn(),
        reset: vi.fn(),
        capture: vi.fn(),
      },
      feedbackService: {
        mode: "test",
        unavailableReason: null,
        unavailableReasonFor: vi.fn().mockReturnValue(null),
        submit: vi.fn(),
      },
    });
    const reset = vi.spyOn(root.feedStore, "reset");
    const accountA = { uid: "did:plc:a", email: null, displayName: "Alice" };
    const accountB = { uid: "did:plc:b", email: null, displayName: "Bob" };

    authService.emit(accountA);
    authService.emit({ ...accountA });
    authService.emit(accountB);
    authService.emit(null);

    expect(reset).toHaveBeenCalledTimes(3);
    expect(root.authStore.isInitialized).toBe(true);
  });

  it("stays initializing until the first authentication callback", () => {
    const authService = new TestAuthService(false);
    const root = new RootStore({
      authService,
      feedApiService: {
        listFeeds: vi.fn(),
        getFeedDetail: vi.fn(),
        getPreferences: vi.fn().mockResolvedValue({}),
        patchPreferences: vi.fn(),
      },
      analyticsService: {
        identify: vi.fn(),
        reset: vi.fn(),
        capture: vi.fn(),
      },
      feedbackService: {
        mode: "test",
        unavailableReason: null,
        unavailableReasonFor: vi.fn().mockReturnValue(null),
        submit: vi.fn(),
      },
    });

    expect(root.authStore.isInitialized).toBe(false);
    authService.emit(null);
    expect(root.authStore.isInitialized).toBe(true);
  });
});
