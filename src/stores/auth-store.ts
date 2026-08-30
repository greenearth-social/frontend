import { makeAutoObservable } from "mobx";
import type { RootStore } from "./root-store";

export class AuthStore {
  root: RootStore;
  currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  isInitialized = false;

  constructor(root: RootStore) {
    this.root = root;
    this.currentUser = this.root.services.authService.currentUser;
    makeAutoObservable(this, { root: false });
    this.root.services.authService.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.isInitialized = true;
      if (user) {
        this.root.uiStore.activateAccount(user.uid);
        this.root.feedStore.activateAccount(user.uid);
        this.root.preferencesStore.activateAccount(user.uid);
        this.root.settingsPreviewStore.activateAccount(user.uid);
        this.root.services.analyticsService.identify(user.uid);
      } else {
        this.root.uiStore.deactivateAccount();
        this.root.feedStore.reset();
        this.root.preferencesStore.reset();
        this.root.settingsPreviewStore.reset();
        this.root.services.analyticsService.reset();
      }
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
