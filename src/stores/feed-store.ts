import { makeAutoObservable } from "mobx";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import { buildFeedItems } from "../models/feed-debug-snapshot";
import type { RootStore } from "./root-store";

export class FeedStore {
  root: RootStore;
  items: FeedItemView[];
  isLoading: boolean;
  error: string | null;
  lastGeneratedAt: string | null;

  constructor(root: RootStore) {
    this.root = root;
    this.items = [];
    this.isLoading = false;
    this.error = null;
    this.lastGeneratedAt = null;
    makeAutoObservable(this, { root: false });
  }

  async loadFeed(): Promise<void> {
    const active = this.root.accountStore.activeAccount;
    if (!active) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const snapshot = await this.root.services.feedDebugService.loadLatestSnapshot(
        active.did,
      );
      if (!snapshot) {
        this.items = [];
        this.lastGeneratedAt = null;
        return;
      }

      const uris = snapshot.finalOrder;
      const hydrated = await this.root.services.hydrationService.hydratePosts(
        uris,
      );

      this.items = buildFeedItems(snapshot, hydrated);
      this.lastGeneratedAt = snapshot.generatedAt;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to load feed";
      this.items = [];
    } finally {
      this.isLoading = false;
    }
  }

  async refreshFeed(): Promise<void> {
    const active = this.root.accountStore.activeAccount;
    if (!active) return;

    this.isLoading = true;
    this.error = null;

    try {
      await this.root.services.feedDebugService.triggerSnapshot(active.did);
      await this.loadFeed();
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to refresh feed";
    } finally {
      this.isLoading = false;
    }
  }
}
