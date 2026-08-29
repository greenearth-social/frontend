import { makeAutoObservable } from "mobx";
import type {
  FeedItemView,
  FeedSummary,
  FilteringCounts,
  GeneratorDiagnostic,
} from "../models/feed-debug-snapshot";
import { transformFeedItems } from "../models/feed-debug-snapshot";
import type { AlgorithmId } from "../constants/algorithms";
import type { RootStore } from "./root-store";

const DEFAULT_POSTS_PER_PAGE = 20;

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
  currentApiReleaseSha: string | null = null;

  feedList: FeedSummary[] = [];
  currentRequestId: string | null = null;
  filteringCountsByRequest: Record<string, FilteringCounts> = {};
  generatorDiagnosticsByRequest: Record<string, GeneratorDiagnostic[]> = {};

  private _feedListLoadSeq: number = 0;
  private _loadSeq: number = 0;
  private _accountId: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  activateAccount(accountId: string): void {
    if (this._accountId === accountId) return;
    this.reset();
    this._accountId = accountId;
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

  get currentSummary(): FeedSummary | null {
    if (!this.currentRequestId) return null;
    return this.feedList.find((feed) => feed.requestId === this.currentRequestId) ?? null;
  }

  get currentFilteringCounts(): FilteringCounts | null {
    if (!this.currentRequestId) return null;
    return this.filteringCountsByRequest[this.currentRequestId] ?? null;
  }

  get currentGeneratorDiagnostics(): GeneratorDiagnostic[] {
    if (!this.currentRequestId) return [];
    return (
      this.generatorDiagnosticsByRequest[this.currentRequestId] ??
      this.currentSummary?.generatorDiagnostics ??
      []
    );
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
    this.lastGeneratedAt = null;
    this.currentApiReleaseSha = null;
  }

  reset(): void {
    this._feedListLoadSeq++;
    this._loadSeq++;
    this._accountId = null;
    this._allItems = [];
    this._currentPage = 1;
    this._postsPerPage = DEFAULT_POSTS_PER_PAGE;
    this.items = [];
    this.isLoading = false;
    this.feedListLoadState = "idle";
    this.error = null;
    this.lastGeneratedAt = null;
    this.currentApiReleaseSha = null;
    this.feedList = [];
    this.currentRequestId = null;
    this.filteringCountsByRequest = {};
    this.generatorDiagnosticsByRequest = {};
  }

  async loadFeedList(options?: { feedName?: AlgorithmId; force?: boolean }): Promise<void> {
    if (this.isLoading && !options?.force) return;

    if (options?.force) {
      // An explicit refresh supersedes both an older list request and any
      // detail request that could otherwise populate the newly selected page.
      this._loadSeq++;
    }

    const seq = ++this._feedListLoadSeq;
    this.isLoading = true;
    this.feedListLoadState = "loading";
    this.error = null;

    try {
      const response = await this.root.services.feedApiService.listFeeds();
      if (seq !== this._feedListLoadSeq) return;

      this.feedList = response.feeds ?? [];
      this.feedListLoadState = "loaded";

      const currentAlgo = options?.feedName ?? this.root.uiStore.selectedAlgorithm ?? "your-feed";
      if (this.root.uiStore.selectedAlgorithm === null) {
        this.root.uiStore.setSelectedAlgorithm(currentAlgo);
      }

      // A pull can finish after the user navigates to a different feed. Keep
      // the refreshed summaries, but never put the old feed's detail there.
      if (options?.feedName !== undefined && this.root.uiStore.selectedAlgorithm !== currentAlgo)
        return;

      const latestForAlgo = this.feedList
        .filter((f) => f.feedName === currentAlgo)
        .reduce<FeedSummary | undefined>(
          (best, f) => (!best || f.generatedAt > best.generatedAt ? f : best),
          undefined,
        );
      if (latestForAlgo) {
        await this.loadFeedDetail(latestForAlgo.requestId);
      } else {
        this.clearFeedDetail();
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

  /** Quietly check for a newer snapshot without replacing existing content on failure. */
  async refreshFeedIfNew(
    feedName: AlgorithmId,
    baselineRequestId: string | null,
  ): Promise<boolean> {
    // Do not supersede an intentional route, tab, or pull-to-refresh load.
    // The page queues a trailing lifecycle sync after that visible load completes.
    if (this.isLoading) return false;
    const seq = ++this._feedListLoadSeq;

    try {
      const response = await this.root.services.feedApiService.listFeeds();
      if (seq !== this._feedListLoadSeq) return false;

      const currentRequestBelongsToFeed = this.feedList.some(
        (feed) => feed.requestId === this.currentRequestId && feed.feedName === feedName,
      );
      this.feedList = response.feeds ?? [];
      this.feedListLoadState = "loaded";
      const latest = this.feedList
        .filter((feed) => feed.feedName === feedName)
        .reduce<FeedSummary | undefined>(
          (best, feed) => (!best || feed.generatedAt > best.generatedAt ? feed : best),
          undefined,
        );

      if (!latest && currentRequestBelongsToFeed && this.root.uiStore.selectedAlgorithm === feedName) {
        // A successful list response is authoritative. This notably removes a
        // bootstrap-empty snapshot after the API classifies it as pre-history,
        // instead of leaving its previously loaded detail visible in memory.
        this.clearFeedDetail();
        return false;
      }

      if (
        !latest ||
        latest.requestId === baselineRequestId ||
        this.root.uiStore.selectedAlgorithm !== feedName
      ) {
        return false;
      }

      await this.loadFeedDetail(latest.requestId, { background: true });
      return this.currentRequestId === latest.requestId;
    } catch (error) {
      // This is a background convenience refresh. Keep the current snapshot
      // visible and let the next lifecycle trigger retry quietly.
      console.error("FeedStore.refreshFeedIfNew error:", error);
      return false;
    }
  }

  async loadFeedDetail(requestId: string, options?: { background?: boolean }): Promise<void> {
    const background = options?.background ?? false;
    const seq = ++this._loadSeq;
    if (!background) {
      this.isLoading = true;
      this.error = null;
    }

    try {
      const response = await this.root.services.feedApiService.getFeedDetail(requestId);
      if (seq !== this._loadSeq) return;

      this._allItems = transformFeedItems(response.items ?? []);
      this.filteringCountsByRequest[requestId] = response.filteringCounts;
      this.generatorDiagnosticsByRequest[requestId] =
        response.generatorDiagnostics && response.generatorDiagnostics.length > 0
          ? response.generatorDiagnostics
          : (this.feedList.find((feed) => feed.requestId === requestId)?.generatorDiagnostics ??
            []);
      this.currentRequestId = requestId;
      this._currentPage = 1;
      this._updateVisibleItems();
      this.lastGeneratedAt = response.generatedAt;
      this.currentApiReleaseSha = response.apiReleaseSha;
    } catch (e) {
      if (seq !== this._loadSeq) return;

      console.error("FeedStore.loadFeedDetail error:", e);
      if (background) return;
      this.error = e instanceof Error ? e.message : "Failed to load feed";
      this._allItems = [];
      this.currentApiReleaseSha = null;
      this._currentPage = 1;
      this._updateVisibleItems();
    } finally {
      if (!background && seq === this._loadSeq) {
        this.isLoading = false;
      }
    }
  }
}
