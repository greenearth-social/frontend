import { makeAutoObservable, autorun } from "mobx";
import type { BlueskyAccount } from "../models/bluesky-account";
import type { RootStore } from "./root-store";

export class AccountStore {
  root: RootStore;
  activeAccount: BlueskyAccount | null = null;
  #resolving: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });

    autorun(() => {
      const user = this.root.authStore.currentUser;
      if (!user) {
        this.activeAccount = null;
        this.#resolving = null;
        return;
      }
      if (!this.activeAccount || this.activeAccount.did !== user.uid) {
        void this.#resolveHandle(user.uid, user.email ?? undefined);
      }
    });
  }

  async #resolveHandle(did: string, email?: string) {
    if (this.#resolving === did) return;
    this.#resolving = did;

    if (!did.startsWith("did:plc:")) {
      this.activeAccount = {
        did,
        handle: email ?? did,
        displayName: email ?? did,
      };
      return;
    }

    try {
      const res = await fetch(`https://plc.directory/${did}`);
      const doc = (await res.json()) as { alsoKnownAs?: string[] };
      const handle = doc.alsoKnownAs?.[0]?.replace("at://", "");
      if (handle) {
        this.activeAccount = { did, handle, displayName: handle };
      }
    } catch {
      // Leave null on failure
    }
  }
}
