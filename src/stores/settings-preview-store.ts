import { makeAutoObservable } from "mobx";
import type { AlgorithmId } from "../constants/algorithms";
import type {
  FeedDetailResponse,
  FeedItemView,
  FilteringCounts,
  GeneratorDiagnostic,
} from "../models/feed-debug-snapshot";
import { transformFeedItems } from "../models/feed-debug-snapshot";
import { emptySnapshotExplanation } from "../models/feed-empty-state";
import { FeedApiError, type FeedPreferences } from "../services/types";
import type { RootStore } from "./root-store";

const BASELINE_MAX_AGE_MS = 10 * 60 * 1000;
const HYDRATION_RETRY_DELAYS_MS = [300, 700, 1_500] as const;
const PREVIEW_CACHE_MAX_ENTRIES = 8;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function generatorLabel(name: string): string {
  switch (name) {
    case "followed_users":
      return "Following";
    case "network_likes":
      return "Liked by Following";
    case "two_tower":
      return "Authors & Topics";
    case "popularity":
      return "Popular";
    case "llm_query_vector":
      return "Prompt";
    default:
      return name.split("_").join(" ");
  }
}

// Names everything that decides which posts a preview shows, so a saved
// preview can only be reused for the same account, feed, prompt and settings.
function signature(
  accountId: string | null,
  feedName: AlgorithmId,
  promptKey: string | null,
  patch: FeedPreferences,
): string {
  return JSON.stringify({
    accountId,
    feedName,
    promptKey,
    sourceWeights: patch.sourceWeights
      ? {
          following: patch.sourceWeights.following,
          networkLikes: patch.sourceWeights.networkLikes,
          authorsTopics: patch.sourceWeights.authorsTopics,
          popular: patch.sourceWeights.popular,
          llm: patch.sourceWeights.llm,
        }
      : undefined,
    freshness: patch.freshness,
    politics: patch.politics,
    purpose: patch.purpose,
    authorPenalty: patch.authorPenalty,
    topicPenalty: patch.topicPenalty,
  });
}

function sameSlate(a: FeedItemView[], b: FeedItemView[]): boolean {
  return a.length === b.length && a.every((item, index) => item.atUri === b[index]?.atUri);
}

export interface GeneratedSettingsPreview {
  feedName: AlgorithmId;
  generation: number;
  requestId: string;
  generatedAt: string;
  expiresAt: string;
  items: FeedItemView[];
  filteringCounts: FilteringCounts;
  generatorDiagnostics: GeneratorDiagnostic[];
  signature: string;
}

export type BaselineRefreshOutcome = {
  status: "updated" | "unchanged" | "deferred" | "error";
};

type DisplayedRequest = { kind: "detail" | "preview"; requestId: string };

const EMPTY_FILTERING_COUNTS: FilteringCounts = {
  storedItemCount: 0,
  displayedItemCount: 0,
  publiclyFilteredCount: 0,
  unavailableCount: 0,
  partialItemCount: 0,
};

export class SettingsPreviewStore {
  root: RootStore;
  activeFeed: AlgorithmId | null = null;
  baselineItems: FeedItemView[] = [];
  displayedItems: FeedItemView[] = [];
  baselineFilteringCounts: FilteringCounts = { ...EMPTY_FILTERING_COUNTS };
  displayedFilteringCounts: FilteringCounts = { ...EMPTY_FILTERING_COUNTS };
  baselineRequestId: string | null = null;
  baselineGeneratedAt: string | null = null;
  isLoadingBaseline = false;
  isRefreshingBaseline = false;
  isGenerating = false;
  isRetryingBlockCheck = false;
  blockRetryError: string | null = null;
  blockCheckExpired = false;
  acceptanceConflict = false;
  error: string | null = null;
  warning: string | null = null;
  baselineRefreshError: string | null = null;
  lastPreviewSignature: string | null = null;
  lastPreviewRequestId: string | null = null;
  lastPreviewGeneratedAt: string | null = null;
  private feedGeneration = 0;
  private previewOperation = 0;
  private refreshOperation = 0;
  private displayRevision = 0;
  private displayedRequest: DisplayedRequest | null = null;
  private pendingPreview: GeneratedSettingsPreview | null = null;
  private activationPromise: Promise<void> | null = null;
  private activationPromiseFeed: AlgorithmId | null = null;
  private refreshPromise: Promise<BaselineRefreshOutcome> | null = null;
  private refreshPromiseFeed: AlgorithmId | null = null;
  private accountId: string | null = null;
  private lastObservedServedRequestId: string | null = null;
  private previewCache = new Map<string, GeneratedSettingsPreview>();

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable<
      this,
      | "activationPromise"
      | "activationPromiseFeed"
      | "refreshPromise"
      | "refreshPromiseFeed"
      | "previewCache"
    >(this, {
      root: false,
      activationPromise: false,
      activationPromiseFeed: false,
      refreshPromise: false,
      refreshPromiseFeed: false,
      previewCache: false,
    });
  }

  activateAccount(accountId: string): void {
    if (this.accountId === accountId) return;
    this.reset();
    this.accountId = accountId;
  }

  reset(): void {
    this.feedGeneration++;
    this.previewOperation++;
    this.refreshOperation++;
    this.accountId = null;
    this.activeFeed = null;
    this.baselineItems = [];
    this.displayedItems = [];
    this.baselineFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.displayedFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.baselineRequestId = null;
    this.baselineGeneratedAt = null;
    this.isLoadingBaseline = false;
    this.isRefreshingBaseline = false;
    this.isGenerating = false;
    this.isRetryingBlockCheck = false;
    this.setDisplayedRequest(null);
    this.acceptanceConflict = false;
    this.displayRevision = 0;
    this.activationPromise = null;
    this.activationPromiseFeed = null;
    this.refreshPromise = null;
    this.refreshPromiseFeed = null;
    this.error = null;
    this.warning = null;
    this.baselineRefreshError = null;
    this.lastPreviewSignature = null;
    this.lastPreviewRequestId = null;
    this.lastPreviewGeneratedAt = null;
    this.lastObservedServedRequestId = null;
    this.previewCache.clear();
  }

  async activateFeed(feedName: AlgorithmId): Promise<void> {
    if (this.activeFeed === feedName) {
      if (this.activationPromise && this.activationPromiseFeed === feedName) {
        await this.activationPromise;
        return;
      }
      if (this.baselineGeneratedAt !== null || this.baselineItems.length > 0) return;
    }

    const generation = ++this.feedGeneration;
    this.previewOperation++;
    this.refreshOperation++;
    this.activeFeed = feedName;
    this.baselineItems = [];
    this.displayedItems = [];
    this.baselineFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.displayedFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.baselineRequestId = null;
    this.baselineGeneratedAt = null;
    this.error = null;
    this.warning = null;
    this.baselineRefreshError = null;
    this.lastPreviewSignature = null;
    this.lastPreviewRequestId = null;
    this.lastPreviewGeneratedAt = null;
    this.lastObservedServedRequestId = null;
    this.isLoadingBaseline = true;
    this.isRefreshingBaseline = false;
    this.isGenerating = false;
    this.isRetryingBlockCheck = false;
    this.setDisplayedRequest(null);
    this.acceptanceConflict = false;
    this.displayRevision = 0;
    this.refreshPromise = null;
    this.refreshPromiseFeed = null;

    const activation = this.loadBaseline(feedName, generation, this.displayRevision);
    this.activationPromise = activation;
    this.activationPromiseFeed = feedName;
    try {
      await activation;
    } finally {
      if (this.activationPromise === activation) {
        this.activationPromise = null;
        this.activationPromiseFeed = null;
      }
    }
  }

  private async loadBaseline(
    feedName: AlgorithmId,
    generation: number,
    initialDisplayRevision: number,
  ): Promise<void> {
    let staleRequestId: string | null = null;
    try {
      const feedList = await this.root.services.feedApiService.listFeeds();
      if (!this.isCurrentFeed(feedName, generation)) return;
      const latest = (feedList.feeds ?? [])
        .filter((feed) => feed.feedName === feedName)
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
      staleRequestId = latest?.requestId ?? null;
      const generatedAt = latest ? Date.parse(latest.generatedAt) : Number.NaN;
      const isFresh =
        Number.isFinite(generatedAt) && Date.now() - generatedAt <= BASELINE_MAX_AGE_MS;
      if (latest && isFresh) {
        const detail = await this.root.services.feedApiService.getFeedDetail(latest.requestId);
        if (!this.isCurrentFeed(feedName, generation)) return;
        this.setBaseline(
          transformFeedItems(detail.items),
          detail.filteringCounts,
          latest.requestId,
          latest.generatedAt,
          this.displayRevision === initialDisplayRevision,
        );
        this.lastObservedServedRequestId = latest.requestId;
        return;
      }

      try {
        const session = await this.root.services.feedApiService.createFeedPreview(feedName, {});
        const detail = await this.root.services.feedApiService.getFeedPreview(session.requestId);
        if (!this.isCurrentFeed(feedName, generation)) return;
        this.setBaseline(
          transformFeedItems(detail.items),
          detail.filteringCounts,
          null,
          detail.generatedAt,
          this.displayRevision === initialDisplayRevision,
          session.requestId,
        );
        this.lastObservedServedRequestId = staleRequestId;
      } catch (refreshError) {
        if (!staleRequestId) throw refreshError;
        const staleDetail = await this.root.services.feedApiService.getFeedDetail(staleRequestId);
        if (!this.isCurrentFeed(feedName, generation)) return;
        this.warning =
          "The current feed is older than 10 minutes. Preview changes may include newer posts.";
        this.setBaseline(
          transformFeedItems(staleDetail.items),
          staleDetail.filteringCounts,
          staleRequestId,
          staleDetail.generatedAt,
          this.displayRevision === initialDisplayRevision,
        );
        this.lastObservedServedRequestId = staleRequestId;
      }
    } catch (error) {
      if (!this.isCurrentFeed(feedName, generation)) return;
      if (this.displayRevision === initialDisplayRevision) {
        this.error = error instanceof Error ? error.message : "Could not load the current feed";
      }
    } finally {
      if (this.isCurrentFeed(feedName, generation)) {
        this.isLoadingBaseline = false;
      }
    }
  }

  async refreshBaselineIfNew(feedName: AlgorithmId): Promise<BaselineRefreshOutcome> {
    if (this.activeFeed !== feedName) return { status: "unchanged" };
    if (this.refreshPromise && this.refreshPromiseFeed === feedName) {
      return this.refreshPromise;
    }
    if (
      this.isLoadingBaseline ||
      this.isGenerating ||
      this.isRefreshingBaseline ||
      this.isRetryingBlockCheck
    ) {
      return { status: "deferred" };
    }

    const refresh = this.runBaselineRefresh(feedName);
    this.refreshPromise = refresh;
    this.refreshPromiseFeed = feedName;
    try {
      return await refresh;
    } finally {
      if (this.refreshPromise === refresh) {
        this.refreshPromise = null;
        this.refreshPromiseFeed = null;
      }
    }
  }

  private async runBaselineRefresh(feedName: AlgorithmId): Promise<BaselineRefreshOutcome> {
    const refreshOperation = ++this.refreshOperation;
    const generation = this.feedGeneration;
    this.isRefreshingBaseline = true;
    this.baselineRefreshError = null;
    try {
      const feedList = await this.root.services.feedApiService.listFeeds();
      if (refreshOperation !== this.refreshOperation || !this.isCurrentFeed(feedName, generation)) {
        return { status: "deferred" };
      }
      const latest = (feedList.feeds ?? [])
        .filter((feed) => feed.feedName === feedName)
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
      if (!latest) return { status: "unchanged" };
      if (
        latest.requestId === this.baselineRequestId ||
        latest.requestId === this.lastObservedServedRequestId
      ) {
        this.lastObservedServedRequestId = latest.requestId;
        return { status: "unchanged" };
      }

      const latestTime = Date.parse(latest.generatedAt);
      const baselineTime = this.baselineGeneratedAt ? Date.parse(this.baselineGeneratedAt) : NaN;
      if (
        Number.isFinite(latestTime) &&
        Number.isFinite(baselineTime) &&
        latestTime <= baselineTime
      ) {
        this.lastObservedServedRequestId = latest.requestId;
        return { status: "unchanged" };
      }

      const detail = await this.root.services.feedApiService.getFeedDetail(latest.requestId);
      if (refreshOperation !== this.refreshOperation || !this.isCurrentFeed(feedName, generation)) {
        return { status: "deferred" };
      }

      this.lastObservedServedRequestId = latest.requestId;
      this.setBaseline(
        transformFeedItems(detail.items),
        detail.filteringCounts,
        latest.requestId,
        latest.generatedAt,
        true,
      );
      this.lastPreviewSignature = null;
      this.lastPreviewRequestId = null;
      this.lastPreviewGeneratedAt = null;
      this.warning = null;
      return { status: "updated" };
    } catch (error) {
      if (refreshOperation === this.refreshOperation && this.isCurrentFeed(feedName, generation)) {
        this.baselineRefreshError =
          error instanceof Error ? error.message : "Could not refresh the current feed";
      }
      return { status: "error" };
    } finally {
      if (refreshOperation === this.refreshOperation && this.isCurrentFeed(feedName, generation)) {
        this.isRefreshingBaseline = false;
      }
    }
  }

  async preview(patch: FeedPreferences): Promise<GeneratedSettingsPreview | null> {
    if (!this.activeFeed || this.isGenerating || this.isRetryingBlockCheck) return null;
    const feedName = this.activeFeed;
    const previewSignature = this.previewSignature(feedName, patch);
    const generation = this.feedGeneration;
    const previewOperation = ++this.previewOperation;
    const isCurrent = (): boolean =>
      previewOperation === this.previewOperation && this.isCurrentFeed(feedName, generation);
    this.refreshOperation++;
    this.isRefreshingBaseline = false;
    this.acceptanceConflict = false;
    this.error = null;
    const cached = this.cachedPreview(previewSignature, generation);

    this.isGenerating = true;
    try {
      if (cached) {
        try {
          const detail = await this.root.services.feedApiService.getFeedPreview(cached.requestId);
          if (!isCurrent()) return null;
          const refreshed = this.withDetail(cached, detail);
          if (
            !refreshed.filteringCounts.blockCheckUnavailableCount &&
            sameSlate(cached.items, refreshed.items)
          ) {
            return this.rememberPreview(refreshed);
          }
        } catch (error) {
          if (!(error instanceof FeedApiError && error.status === 404)) throw error;
          if (!isCurrent()) return null;
        }
      }
      const generated = await this.generatePreview(feedName, patch, previewSignature, generation);
      return isCurrent() ? this.rememberPreview(generated) : null;
    } catch (error) {
      if (isCurrent()) {
        this.error = error instanceof Error ? error.message : "Could not generate a preview";
      }
      return null;
    } finally {
      if (isCurrent()) {
        this.isGenerating = false;
      }
    }
  }

  async acceptGeneratedPreview(
    preview: GeneratedSettingsPreview,
    patch: FeedPreferences,
  ): Promise<GeneratedSettingsPreview | null> {
    const { feedName, generation, signature: previewSignature } = preview;
    if (!this.isCurrentFeed(feedName, generation)) return null;
    this.acceptanceConflict = false;
    if (preview.filteringCounts.blockCheckUnavailableCount) return preview;

    try {
      await this.stagePreview(preview, patch);
      if (!this.isCurrentFeed(feedName, generation)) return null;
      return preview;
    } catch (error) {
      let acceptanceError = error;
      if (error instanceof FeedApiError && error.status === 404) {
        try {
          const regenerated = await this.generatePreview(
            feedName,
            patch,
            previewSignature,
            generation,
          );
          if (!this.isCurrentFeed(feedName, generation)) return null;
          if (!regenerated.filteringCounts.blockCheckUnavailableCount) {
            await this.stagePreview(regenerated, patch);
          }
          if (!this.isCurrentFeed(feedName, generation)) return null;
          return this.rememberPreview(regenerated);
        } catch (retryError) {
          acceptanceError = retryError;
        }
      }

      if (this.isCurrentFeed(feedName, generation)) {
        if (acceptanceError instanceof FeedApiError && acceptanceError.status === 409) {
          this.acceptanceConflict = true;
          this.error = null;
        } else {
          this.error =
            acceptanceError instanceof Error
              ? acceptanceError.message
              : "Preview could not be synchronized with MySky. Try again.";
        }
      }
      return null;
    }
  }

  async retryBlockCheck(patch: FeedPreferences, canStage: () => boolean): Promise<void> {
    const request = this.displayedRequest;
    const feed = this.activeFeed;
    if (
      !request ||
      !feed ||
      this.isGenerating ||
      this.isRefreshingBaseline ||
      this.isRetryingBlockCheck ||
      this.blockCheckExpired
    ) {
      return;
    }
    const generation = this.feedGeneration;
    const revision = this.displayRevision;
    const pending = this.pendingPreview;
    const isCurrent = (): boolean =>
      this.isCurrentFeed(feed, generation) && this.displayRevision === revision;
    this.isRetryingBlockCheck = true;
    this.blockRetryError = null;
    try {
      const api = this.root.services.feedApiService;
      const detail =
        request.kind === "detail"
          ? await api.getFeedDetail(request.requestId)
          : await api.getFeedPreview(request.requestId);
      if (!isCurrent()) return;
      if (pending) {
        const refreshed = this.withDetail(pending, detail);
        let stageFailure: { error: unknown } | undefined;
        if (
          !detail.filteringCounts.blockCheckUnavailableCount &&
          canStage() &&
          this.previewSignature(feed, patch) === pending.signature
        ) {
          try {
            await this.stagePreview(refreshed, patch);
          } catch (error) {
            stageFailure = { error };
          }
          if (!isCurrent()) return;
        }
        this.rememberPreview(refreshed);
        this.acceptPreview(refreshed);
        if (stageFailure) {
          this.setBlockRetryError(
            stageFailure.error,
            request.kind,
            "Preview could not be synchronized with MySky. Select Update preview to try again.",
          );
        }
      } else {
        this.setBaseline(
          transformFeedItems(detail.items),
          detail.filteringCounts,
          request.kind === "detail" ? request.requestId : null,
          detail.generatedAt,
          true,
          request.kind === "preview" ? request.requestId : undefined,
        );
      }
    } catch (error) {
      if (isCurrent()) this.setBlockRetryError(error, request.kind);
    } finally {
      if (this.isCurrentFeed(feed, generation)) this.isRetryingBlockCheck = false;
    }
  }

  private stagePreview(
    preview: GeneratedSettingsPreview,
    patch: FeedPreferences,
  ): Promise<unknown> {
    return this.root.services.feedApiService.acceptFeedPreview(
      preview.feedName,
      preview.requestId,
      patch,
      preview.items.map((item) => item.atUri),
    );
  }

  private setBlockRetryError(
    error: unknown,
    kind: DisplayedRequest["kind"],
    message = "The preview could not be updated. Please try again.",
  ): void {
    this.blockCheckExpired = error instanceof FeedApiError && error.status === 404;
    this.blockRetryError = this.blockCheckExpired
      ? kind === "preview"
        ? "This preview expired. Select Preview or Update preview to generate it again."
        : "This feed snapshot has expired. Select Preview or Update preview to load posts."
      : message;
  }

  markPreviewSyncFailure(): void {
    this.acceptanceConflict = false;
    this.error = "Preview could not be synchronized with MySky. Try again.";
  }

  acceptPreview(preview: GeneratedSettingsPreview): void {
    if (preview.feedName !== this.activeFeed || preview.generation !== this.feedGeneration) return;
    this.displayedItems = preview.items;
    this.displayedFilteringCounts = preview.filteringCounts;
    this.setDisplayedRequest({ kind: "preview", requestId: preview.requestId });
    this.pendingPreview = preview.filteringCounts.blockCheckUnavailableCount ? preview : null;
    this.displayRevision++;
    this.acceptanceConflict = false;
    this.error = null;
    const partialCount = preview.filteringCounts.partialItemCount ?? 0;
    if (partialCount > 0) {
      this.warning = `${String(partialCount)} ranked ${partialCount === 1 ? "post is" : "posts are"} shown with limited details because Bluesky could not load the full post data.`;
    } else if (preview.items.length === 0) {
      this.warning = emptySnapshotExplanation(
        preview.filteringCounts,
        preview.generatorDiagnostics,
      );
    } else {
      this.warning = null;
    }
    this.lastPreviewSignature = preview.signature;
    this.lastPreviewRequestId = preview.requestId;
    this.lastPreviewGeneratedAt = preview.generatedAt;
  }

  get isDisplayingBaseline(): boolean {
    return sameSlate(this.displayedItems, this.baselineItems);
  }

  private setBaseline(
    items: FeedItemView[],
    filteringCounts: FilteringCounts,
    requestId: string | null,
    generatedAt: string | null,
    replaceDisplayed: boolean,
    previewRequestId?: string,
  ): void {
    this.baselineItems = [...items];
    this.baselineFilteringCounts = { ...filteringCounts };
    if (replaceDisplayed) {
      this.displayedItems = [...items];
      this.displayedFilteringCounts = { ...filteringCounts };
      const displayedRequestId = requestId ?? previewRequestId;
      this.setDisplayedRequest(
        displayedRequestId
          ? { kind: requestId ? "detail" : "preview", requestId: displayedRequestId }
          : null,
      );
      this.displayRevision++;
    }
    this.baselineRequestId = requestId;
    this.baselineGeneratedAt = generatedAt;
    this.error = null;
  }

  private setDisplayedRequest(request: DisplayedRequest | null): void {
    this.displayedRequest = request;
    this.pendingPreview = null;
    this.blockRetryError = null;
    this.blockCheckExpired = false;
  }

  private previewSignature(feed: AlgorithmId, patch: FeedPreferences): string {
    return signature(
      this.accountId,
      feed,
      this.root.preferencesStore.llmPrompt?.promptKey ?? null,
      patch,
    );
  }

  private withDetail(
    preview: GeneratedSettingsPreview,
    detail: FeedDetailResponse,
  ): GeneratedSettingsPreview {
    return {
      ...preview,
      items: transformFeedItems(detail.items),
      filteringCounts: detail.filteringCounts,
      generatorDiagnostics: detail.generatorDiagnostics ?? [],
    };
  }

  private isCurrentFeed(feedName: AlgorithmId, generation: number): boolean {
    return this.activeFeed === feedName && this.feedGeneration === generation;
  }

  private cachedPreview(
    previewSignature: string,
    generation: number,
  ): GeneratedSettingsPreview | null {
    const cached = this.previewCache.get(previewSignature);
    if (!cached) return null;
    const expiresAt = Date.parse(cached.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      this.previewCache.delete(previewSignature);
      return null;
    }
    // Keep recently requested settings available for the server-side TTL.
    this.previewCache.delete(previewSignature);
    this.previewCache.set(previewSignature, cached);
    return {
      ...cached,
      generation,
      items: [...cached.items],
      filteringCounts: { ...cached.filteringCounts },
      generatorDiagnostics: [...cached.generatorDiagnostics],
    };
  }

  private rememberPreview(preview: GeneratedSettingsPreview): GeneratedSettingsPreview {
    this.previewCache.delete(preview.signature);
    this.previewCache.set(preview.signature, preview);
    while (this.previewCache.size > PREVIEW_CACHE_MAX_ENTRIES) {
      const oldest = this.previewCache.keys().next().value;
      if (oldest === undefined) break;
      this.previewCache.delete(oldest);
    }
    return preview;
  }

  private async generatePreview(
    feedName: AlgorithmId,
    patch: FeedPreferences,
    previewSignature: string,
    generation: number,
  ): Promise<GeneratedSettingsPreview> {
    const session = await this.root.services.feedApiService.createFeedPreview(feedName, patch);
    let detail = await this.root.services.feedApiService.getFeedPreview(session.requestId);
    for (const retryDelay of HYDRATION_RETRY_DELAYS_MS) {
      if (
        !detail.filteringCounts.partialItemCount ||
        detail.filteringCounts.blockCheckUnavailableCount
      )
        break;
      await delay(retryDelay);
      if (!this.isCurrentFeed(feedName, generation)) break;
      try {
        detail = await this.root.services.feedApiService.getFeedPreview(session.requestId);
      } catch {
        // The initial hydrated response remains truthful and usable. A failed
        // follow-up should not discard it or turn a transient cache read into
        // a failed Preview.
        break;
      }
    }
    const diagnostics = detail.generatorDiagnostics ?? [];
    const failedDiagnostics = diagnostics.filter(
      (diagnostic) =>
        diagnostic.weight > 0 &&
        ["error", "timeout", "not_configured", "not_run"].includes(diagnostic.status),
    );
    if (detail.filteringCounts.storedItemCount === 0 && failedDiagnostics.length > 0) {
      const sources = failedDiagnostics.map((diagnostic) => generatorLabel(diagnostic.name));
      throw new Error(
        `Preview could not load ${sources.join(" and ")} posts. Your current preview was kept; try again.`,
      );
    }
    return {
      feedName,
      generation,
      requestId: session.requestId,
      generatedAt: detail.generatedAt,
      expiresAt: session.expiresAt,
      items: transformFeedItems(detail.items),
      filteringCounts: detail.filteringCounts,
      generatorDiagnostics: diagnostics,
      signature: previewSignature,
    };
  }
}
