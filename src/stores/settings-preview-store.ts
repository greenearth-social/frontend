import { makeAutoObservable } from "mobx";
import type { AlgorithmId } from "../constants/algorithms";
import type {
  FeedItemView,
  FilteringCounts,
  GeneratorDiagnostic,
} from "../models/feed-debug-snapshot";
import { transformFeedItems } from "../models/feed-debug-snapshot";
import { FeedApiError, type FeedPreferences } from "../services/types";
import type { RootStore } from "./root-store";

const BASELINE_MAX_AGE_MS = 10 * 60 * 1000;
const HYDRATION_RETRY_DELAY_MS = 500;

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
    default:
      return name.split("_").join(" ");
  }
}

function signature(feedName: AlgorithmId, patch: FeedPreferences): string {
  return JSON.stringify({ feedName, patch });
}

function sameSlate(a: FeedItemView[], b: FeedItemView[]): boolean {
  return a.length === b.length && a.every((item, index) => item.atUri === b[index]?.atUri);
}

export interface GeneratedSettingsPreview {
  feedName: AlgorithmId;
  generation: number;
  requestId: string;
  generatedAt: string;
  items: FeedItemView[];
  filteringCounts: FilteringCounts;
  generatorDiagnostics: GeneratorDiagnostic[];
  signature: string;
}

export type BaselineRefreshOutcome = {
  status: "updated" | "unchanged" | "deferred" | "error";
};

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
  private activationPromise: Promise<void> | null = null;
  private activationPromiseFeed: AlgorithmId | null = null;
  private refreshPromise: Promise<BaselineRefreshOutcome> | null = null;
  private refreshPromiseFeed: AlgorithmId | null = null;
  private accountId: string | null = null;
  private lastObservedServedRequestId: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable<
      this,
      "activationPromise" | "activationPromiseFeed" | "refreshPromise" | "refreshPromiseFeed"
    >(this, {
      root: false,
      activationPromise: false,
      activationPromiseFeed: false,
      refreshPromise: false,
      refreshPromiseFeed: false,
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
    if (this.isLoadingBaseline || this.isGenerating || this.isRefreshingBaseline) {
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
    if (!this.activeFeed || this.isGenerating) return null;
    const feedName = this.activeFeed;
    const previewSignature = signature(feedName, patch);
    const generation = this.feedGeneration;
    const previewOperation = ++this.previewOperation;
    this.refreshOperation++;
    this.isRefreshingBaseline = false;
    this.isGenerating = true;
    this.error = null;
    try {
      const generated = await this.generatePreview(feedName, patch, previewSignature, generation);
      if (previewOperation !== this.previewOperation || !this.isCurrentFeed(feedName, generation)) {
        return null;
      }
      return generated;
    } catch (error) {
      if (previewOperation === this.previewOperation && this.isCurrentFeed(feedName, generation)) {
        this.error = error instanceof Error ? error.message : "Could not generate a preview";
      }
      return null;
    } finally {
      if (previewOperation === this.previewOperation && this.isCurrentFeed(feedName, generation)) {
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

    const accept = async (candidate: GeneratedSettingsPreview): Promise<void> => {
      await this.root.services.feedApiService.acceptFeedPreview(
        candidate.feedName,
        candidate.requestId,
        patch,
        candidate.items.map((item) => item.atUri),
      );
    };

    try {
      await accept(preview);
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
          await accept(regenerated);
          if (!this.isCurrentFeed(feedName, generation)) return null;
          return regenerated;
        } catch (retryError) {
          acceptanceError = retryError;
        }
      }

      if (this.isCurrentFeed(feedName, generation)) {
        this.error =
          acceptanceError instanceof FeedApiError && acceptanceError.status === 409
            ? "Settings changed before Preview could be synchronized. Preview again."
            : acceptanceError instanceof Error
              ? acceptanceError.message
              : "Preview could not be synchronized with MySky. Try again.";
      }
      return null;
    }
  }

  acceptPreview(preview: GeneratedSettingsPreview): void {
    if (preview.feedName !== this.activeFeed || preview.generation !== this.feedGeneration) return;
    this.displayedItems = preview.items;
    this.displayedFilteringCounts = preview.filteringCounts;
    this.displayRevision++;
    this.error = null;
    const partialCount = preview.filteringCounts.partialItemCount ?? 0;
    if (partialCount > 0) {
      this.warning = `${String(partialCount)} ranked ${partialCount === 1 ? "post is" : "posts are"} shown with limited details because Bluesky could not load the full post data.`;
    } else if (preview.items.length === 0) {
      const activeDiagnostics = preview.generatorDiagnostics.filter(
        (diagnostic) => diagnostic.weight > 0,
      );
      const labels = activeDiagnostics.map((diagnostic) => generatorLabel(diagnostic.name));
      const returnedCount = activeDiagnostics.reduce(
        (total, diagnostic) => total + diagnostic.returnedCount,
        0,
      );
      this.warning =
        returnedCount > 0
          ? "Posts were found, but none passed the current ranking and quality filters."
          : `No posts matched ${labels.join(" and ") || "the selected sources"} in the selected time window.`;
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
  ): void {
    this.baselineItems = [...items];
    this.baselineFilteringCounts = { ...filteringCounts };
    if (replaceDisplayed) {
      this.displayedItems = [...items];
      this.displayedFilteringCounts = { ...filteringCounts };
      this.displayRevision++;
    }
    this.baselineRequestId = requestId;
    this.baselineGeneratedAt = generatedAt;
    this.error = null;
  }

  private isCurrentFeed(feedName: AlgorithmId, generation: number): boolean {
    return this.activeFeed === feedName && this.feedGeneration === generation;
  }

  private async generatePreview(
    feedName: AlgorithmId,
    patch: FeedPreferences,
    previewSignature: string,
    generation: number,
  ): Promise<GeneratedSettingsPreview> {
    const session = await this.root.services.feedApiService.createFeedPreview(feedName, patch);
    let detail = await this.root.services.feedApiService.getFeedPreview(session.requestId);
    if ((detail.filteringCounts.partialItemCount ?? 0) > 0) {
      await delay(HYDRATION_RETRY_DELAY_MS);
      if (this.isCurrentFeed(feedName, generation)) {
        const retried = await this.root.services.feedApiService.getFeedPreview(session.requestId);
        if (
          (retried.filteringCounts.partialItemCount ?? 0) <
            (detail.filteringCounts.partialItemCount ?? 0) ||
          (retried.items?.length ?? 0) > (detail.items?.length ?? 0)
        ) {
          detail = retried;
        }
      }
    }
    const diagnostics = detail.generatorDiagnostics ?? [];
    const failedDiagnostics = diagnostics.filter(
      (diagnostic) =>
        diagnostic.weight > 0 &&
        ["error", "timeout", "not_configured", "not_run"].includes(diagnostic.status),
    );
    if ((detail.items?.length ?? 0) === 0 && failedDiagnostics.length > 0) {
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
      items: transformFeedItems(detail.items),
      filteringCounts: detail.filteringCounts,
      generatorDiagnostics: diagnostics,
      signature: previewSignature,
    };
  }
}
