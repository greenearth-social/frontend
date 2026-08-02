import { describe, expect, it, vi } from "vitest";
import type { IAuthService, Preferences } from "../services/types";
import { RootStore } from "../stores/root-store";

type User = IAuthService["currentUser"];

class TestAuthService implements IAuthService {
  currentUser: User = null;
  private listener: ((user: User) => void) | null = null;

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
    callback(this.currentUser);
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
  socialRadius: 3,
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
        getPreferences: vi.fn().mockResolvedValue(preferences),
        putPreferences: vi.fn(),
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
  });
});
