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
    const raw = user.displayName ?? "";
    const parts = raw.split("|");
    const name = parts[0]?.trim() || user.uid;
    const domainHandle = parts[1]?.trim() || "";
    const handle = domainHandle || name || user.uid;
    const isHandlePattern = !name.includes(" ") && name.includes(".");
    return {
      did: user.uid,
      handle,
      displayName: isHandlePattern ? name.split(".")[0] : name,
    };
  }
}
