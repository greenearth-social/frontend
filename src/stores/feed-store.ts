import { makeAutoObservable } from "mobx";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import { buildFeedItems } from "../models/feed-debug-snapshot";
import type { RootStore } from "./root-store";

const DEFAULT_POSTS_PER_PAGE = 3;

export class FeedStore {
  root: RootStore;

  private _allItems: FeedItemView[] = [];
  private _currentPage: number = 1;
  private _postsPerPage: number = DEFAULT_POSTS_PER_PAGE;

  items: FeedItemView[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  lastGeneratedAt: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  get currentPage(): number {
    return this._currentPage;
  }

  get totalPages(): number {
    return Math.ceil(this._allItems.length / this._postsPerPage);
  }

  get postsPerPage(): number {
    return this._postsPerPage;
  }

  get totalCount(): number {
    return this._allItems.length;
  }

  get hasMore(): boolean {
    return this._currentPage < this.totalPages;
  }

  private _updateVisibleItems(): void {
    if (this._currentPage > this.totalPages && this.totalPages > 0) {
      this._currentPage = this.totalPages;
    }
    
    const start = (this._currentPage - 1) * this._postsPerPage;
    const end = start + this._postsPerPage;
    this.items = this._allItems.slice(start, end);
  }

  nextPage(): void {
    if (this._currentPage < this.totalPages) {
      this._currentPage++;
      this._updateVisibleItems();
    }
  }

  previousPage(): void {
    if (this._currentPage > 1) {
      this._currentPage--;
      this._updateVisibleItems();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this._currentPage = page;
      this._updateVisibleItems();
    }
  }

  setPostsPerPage(perPage: number): void {
    this._postsPerPage = perPage;
    this._currentPage = 1;
    this._updateVisibleItems();
  }

  async loadFeed(): Promise<void> {
    const active = this.root.accountStore.activeAccount;
    if (!active) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const snapshot =
        await this.root.services.feedDebugService.loadLatestSnapshot(
          active.did,
        );
      if (!snapshot) {
        this._allItems = [];
        this._currentPage = 1;
        this._updateVisibleItems();
        this.lastGeneratedAt = null;
        return;
      }

      const uris = snapshot.finalOrder;
      const hydrated = await this.root.services.hydrationService.hydratePosts(
        uris,
      );

      this._allItems = buildFeedItems(snapshot, hydrated);
      this._currentPage = 1;
      this._updateVisibleItems();
      this.lastGeneratedAt = snapshot.generatedAt;
    } catch (e) {
      console.error("FeedStore.loadFeed error:", e);
      this.error = e instanceof Error ? e.message : "Failed to load feed";
      this._allItems = [];
      this._currentPage = 1;
      this._updateVisibleItems();
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
