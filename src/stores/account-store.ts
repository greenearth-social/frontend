import { makeAutoObservable } from "mobx";
import type { BlueskyAccount } from "../models/bluesky-account";
import type { RootStore } from "./root-store";

export class AccountStore {
  root: RootStore;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  get activeAccount(): BlueskyAccount | null {
    const user = this.root.authStore.currentUser;
    if (!user) return null;
    return {
      did: user.uid,
      handle: user.email ?? user.uid,
      displayName: user.uid,
    };
  }
}
