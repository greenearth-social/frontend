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
    const handle = user.email ?? user.displayName ?? user.uid;
    return {
      did: user.uid,
      handle,
      displayName: user.displayName ?? handle,
    };
  }
}
