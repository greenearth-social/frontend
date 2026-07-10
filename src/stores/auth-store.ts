import { makeAutoObservable } from "mobx";
import type { RootStore } from "./root-store";

export class AuthStore {
  root: RootStore;
  currentUser: { uid: string; email: string | null } | null;

  constructor(root: RootStore) {
    this.root = root;
    this.currentUser = this.root.services.authService.currentUser;
    makeAutoObservable(this, { root: false });
    this.root.services.authService.onAuthStateChanged((user) => {
      this.currentUser = user;
    });
  }

  get isSignedIn(): boolean {
    return this.currentUser !== null;
  }

  async signInWithCustomToken(token: string): Promise<void> {
    await this.root.services.authService.signInWithCustomToken(token);
  }

  async signOut(): Promise<void> {
    await this.root.services.authService.signOut();
  }
}
