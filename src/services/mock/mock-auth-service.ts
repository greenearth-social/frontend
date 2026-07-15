import type { IAuthService } from "../types";

export class MockAuthService implements IAuthService {
  #currentUser: { uid: string; email: string | null; displayName: string | null } | null = null;
  #listeners = new Set<
    (user: { uid: string; email: string | null; displayName: string | null } | null) => void
  >();

  get currentUser() {
    return this.#currentUser;
  }

  constructor() {
    this.#currentUser = null;
  }

  signInWithCustomToken(_token: string): Promise<void> {
    this.#currentUser = {
      uid: "mock-user-1",
      email: "mock@example.com",
      displayName: "Mock User",
    };
    this.#notify();
    return Promise.resolve();
  }

  getIdToken(): Promise<string> {
    return Promise.resolve("mock-id-token");
  }

  signOut(): Promise<void> {
    this.#currentUser = null;
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
