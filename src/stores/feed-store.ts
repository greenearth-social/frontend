import { makeAutoObservable } from "mobx";
import type {
  FeedItemView,
  FeedSummary,
  FilteringCounts,
} from "../models/feed-debug-snapshot";
import { transformFeedItems } from "../models/feed-debug-snapshot";
import { ALGORITHM_FEED_NAME_SET, type AlgorithmId } from "../constants/algorithms";
import type { RootStore } from "./root-store";

const DEFAULT_POSTS_PER_PAGE = 10;

type FeedListLoadState = "idle" | "loading" | "loaded" | "error";

export class FeedStore {
  root: RootStore;

  private _allItems: FeedItemView[] = [];
  private _currentPage: number = 1;
  private _postsPerPage: number = DEFAULT_POSTS_PER_PAGE;

  items: FeedItemView[] = [];
  isLoading: boolean = false;
  feedListLoadState: FeedListLoadState = "idle";
  error: string | null = null;
  lastGeneratedAt: string | null = null;

  feedList: FeedSummary[] = [];
  currentRequestId: string | null = null;
  filteringCountsByRequest: Record<string, FilteringCounts> = {};

  private _feedListLoadSeq: number = 0;
  private _loadSeq: number = 0;

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

  clearFeedDetail(): void {
    this._loadSeq++;
    this._allItems = [];
    this._currentPage = 1;
    this.items = [];
    this.currentRequestId = null;
    this.error = null;
  }

  reset(): void {
    this._feedListLoadSeq++;
    this._loadSeq++;
    this._allItems = [];
    this._currentPage = 1;
    this.items = [];
    this.isLoading = false;
    this.feedListLoadState = "idle";
    this.error = null;
    this.lastGeneratedAt = null;
    this.feedList = [];
    this.currentRequestId = null;
    this.filteringCountsByRequest = {};
  }

  async loadFeedList(): Promise<void> {
    if (this.isLoading) return;

    const seq = ++this._feedListLoadSeq;
    this.isLoading = true;
    this.feedListLoadState = "loading";
    this.error = null;

    try {
      const response = await this.root.services.feedApiService.listFeeds();
      if (seq !== this._feedListLoadSeq) return;

      this.feedList = response.feeds ?? [];
      this.feedListLoadState = "loaded";

      const currentAlgo = this.root.uiStore.selectedAlgorithm;
      if (currentAlgo === null) {
        // Latest mode: load the globally most recent public feed
        const latestPublic = this.feedList
          .filter((f) => ALGORITHM_FEED_NAME_SET.has(f.feedName))
          .reduce<FeedSummary | undefined>(
            (best, f) => (!best || f.generatedAt > best.generatedAt ? f : best),
            undefined,
          );
        if (latestPublic) await this.loadFeedDetail(latestPublic.requestId);
      } else {
        // Specific algo selected: load its most recent snapshot, or leave empty
        const latestForAlgo = this.feedList
          .filter((f) => f.feedName === currentAlgo)
          .reduce<FeedSummary | undefined>(
            (best, f) => (!best || f.generatedAt > best.generatedAt ? f : best),
            undefined,
          );
        if (latestForAlgo) await this.loadFeedDetail(latestForAlgo.requestId);
      }
    } catch (e) {
      if (seq !== this._feedListLoadSeq) return;

      console.error("FeedStore.loadFeedList error:", e);
      this.error = e instanceof Error ? e.message : "Failed to load feed list";
      this.feedListLoadState = "error";
    } finally {
      if (seq === this._feedListLoadSeq) {
        this.isLoading = false;
      }
    }
  }

  async loadFeedDetail(requestId: string): Promise<void> {
    const seq = ++this._loadSeq;
    this.isLoading = true;
    this.error = null;

    try {
      const response = await this.root.services.feedApiService.getFeedDetail(requestId);
      if (seq !== this._loadSeq) return;

      this._allItems = transformFeedItems(response.items ?? []);
      this.filteringCountsByRequest[requestId] = response.filteringCounts;
      this.currentRequestId = requestId;
      this._currentPage = 1;
      this._updateVisibleItems();
      this.lastGeneratedAt = response.generatedAt;
    } catch (e) {
      if (seq !== this._loadSeq) return;

      console.error("FeedStore.loadFeedDetail error:", e);
      this.error = e instanceof Error ? e.message : "Failed to load feed";
      this._allItems = [];
      this._currentPage = 1;
      this._updateVisibleItems();
    } finally {
      if (seq === this._loadSeq) {
        this.isLoading = false;
      }
    }
  }
}
