import type { IAuthService } from "../types";

// Dev servers reload the page whenever a component file changes; without
// this the mock session died with every reload and the app bounced to the
// sign-in screen, whose button needs the real OAuth server.
const STORAGE_KEY = "mock-auth-signed-in";
const MOCK_USER = { uid: "mock-user-1", email: "mock@example.com", displayName: "Mock User" };

function remember(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode, tests): the session is memory-only
  }
}

function remembered(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export class MockAuthService implements IAuthService {
  #currentUser: { uid: string; email: string | null; displayName: string | null } | null = null;
  #listeners = new Set<
    (user: { uid: string; email: string | null; displayName: string | null } | null) => void
  >();

  get currentUser() {
    return this.#currentUser;
  }

  constructor() {
    this.#currentUser = remembered() ? { ...MOCK_USER } : null;
  }

  signInWithCustomToken(_token: string): Promise<void> {
    this.#currentUser = { ...MOCK_USER };
    remember(true);
    this.#notify();
    return Promise.resolve();
  }

  getIdToken(): Promise<string> {
    return Promise.resolve("mock-id-token");
  }

  signOut(): Promise<void> {
    this.#currentUser = null;
    remember(false);
    this.#notify();
    return Promise.resolve();
  }

  onAuthStateChanged(
    callback: (user: { uid: string; email: string | null; displayName: string | null } | null) => void,
  ): () => void {
    this.#listeners.add(callback);
    callback(this.#currentUser);
    return () => {
      this.#listeners.delete(callback);
    };
  }

  #notify() {
    for (const cb of this.#listeners) {
      cb(this.#currentUser);
    }
  }
}
