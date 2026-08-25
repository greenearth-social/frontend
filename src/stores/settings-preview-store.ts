import { makeAutoObservable } from "mobx";
import type { AlgorithmId } from "../constants/algorithms";
import type { FeedItemView, FilteringCounts } from "../models/feed-debug-snapshot";
import { transformFeedItems } from "../models/feed-debug-snapshot";
import type { FeedControlName } from "../services/analytics/types";
import type { FeedPreferences, Preferences, SourceWeights } from "../services/types";
import { FeedApiError } from "../services/types";
import type { RootStore } from "./root-store";
import type { SourceWeightChangeOrigin } from "./preferences-store";

const BASELINE_MAX_AGE_MS = 10 * 60 * 1000;

const CONTROL_PROPERTIES: Record<FeedControlName, keyof Preferences> = {
  source_weights: "sourceWeights",
  freshness: "freshness",
  politics: "politics",
  purpose: "purpose",
};

function clonePreferences(values: Preferences): Preferences {
  return { ...values, sourceWeights: { ...values.sourceWeights } };
}

function sourceWeightsEqual(a: SourceWeights, b: SourceWeights): boolean {
  return (
    a.following === b.following &&
    a.networkLikes === b.networkLikes &&
    a.authorsTopics === b.authorsTopics &&
    a.popular === b.popular
  );
}

function valuesEqual(control: FeedControlName, current: Preferences, saved: Preferences): boolean {
  const property = CONTROL_PROPERTIES[control];
  return control === "source_weights"
    ? sourceWeightsEqual(current.sourceWeights, saved.sourceWeights)
    : current[property] === saved[property];
}

function signature(feedName: AlgorithmId, patch: FeedPreferences): string {
  return JSON.stringify({ feedName, patch });
}

function sameSlate(a: FeedItemView[], b: FeedItemView[]): boolean {
  return a.length === b.length && a.every((item, index) => item.atUri === b[index]?.atUri);
}

export interface GeneratedSettingsPreview {
  requestId: string;
  items: FeedItemView[];
  filteringCounts: FilteringCounts;
  signature: string;
}

const EMPTY_FILTERING_COUNTS: FilteringCounts = {
  storedItemCount: 0,
  displayedItemCount: 0,
  publiclyFilteredCount: 0,
  unavailableCount: 0,
};

export class SettingsPreviewStore {
  root: RootStore;
  activeFeed: AlgorithmId | null = null;
  draft: Preferences | null = null;
  dirtyControls: FeedControlName[] = [];
  origins: Partial<Record<FeedControlName, SourceWeightChangeOrigin>> = {};
  activeControl: FeedControlName | null = null;
  baselineItems: FeedItemView[] = [];
  displayedItems: FeedItemView[] = [];
  baselineFilteringCounts: FilteringCounts = { ...EMPTY_FILTERING_COUNTS };
  displayedFilteringCounts: FilteringCounts = { ...EMPTY_FILTERING_COUNTS };
  isLoadingBaseline = false;
  isGenerating = false;
  isSaving = false;
  error: string | null = null;
  warning: string | null = null;
  lastPreviewSignature: string | null = null;
  lastPreviewRequestId: string | null = null;
  private sequence = 0;
  private accountId: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  activateAccount(accountId: string): void {
    if (this.accountId === accountId) return;
    this.reset();
    this.accountId = accountId;
  }

  reset(): void {
    this.sequence++;
    this.accountId = null;
    this.activeFeed = null;
    this.draft = null;
    this.dirtyControls = [];
    this.origins = {};
    this.activeControl = null;
    this.baselineItems = [];
    this.displayedItems = [];
    this.baselineFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.displayedFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.isLoadingBaseline = false;
    this.isGenerating = false;
    this.isSaving = false;
    this.error = null;
    this.warning = null;
    this.lastPreviewSignature = null;
    this.lastPreviewRequestId = null;
  }

  async activateFeed(feedName: AlgorithmId): Promise<void> {
    if (this.activeFeed === feedName && this.draft !== null) return;
    const requestSequence = ++this.sequence;
    this.activeFeed = feedName;
    this.draft = clonePreferences(this.root.preferencesStore.valuesFor(feedName));
    this.dirtyControls = [];
    this.origins = {};
    this.activeControl = null;
    this.baselineItems = [];
    this.displayedItems = [];
    this.baselineFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.displayedFilteringCounts = { ...EMPTY_FILTERING_COUNTS };
    this.error = null;
    this.warning = null;
    this.lastPreviewSignature = null;
    this.lastPreviewRequestId = null;
    this.isLoadingBaseline = true;

    let staleRequestId: string | null = null;
    try {
      const feedList = await this.root.services.feedApiService.listFeeds();
      if (requestSequence !== this.sequence || this.activeFeed !== feedName) return;
      const latest = (feedList.feeds ?? [])
        .filter((feed) => feed.feedName === feedName)
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
      staleRequestId = latest?.requestId ?? null;
      const generatedAt = latest ? Date.parse(latest.generatedAt) : Number.NaN;
      const isFresh =
        Number.isFinite(generatedAt) && Date.now() - generatedAt <= BASELINE_MAX_AGE_MS;
      if (latest && isFresh) {
        const detail = await this.root.services.feedApiService.getFeedDetail(latest.requestId);
        if (requestSequence !== this.sequence || this.activeFeed !== feedName) return;
        this.setBaseline(transformFeedItems(detail.items), detail.filteringCounts);
        return;
      }

      try {
        const session = await this.root.services.feedApiService.createFeedPreview(feedName, {});
        const detail = await this.root.services.feedApiService.getFeedPreview(session.requestId);
        if (requestSequence !== this.sequence || this.activeFeed !== feedName) return;
        this.setBaseline(transformFeedItems(detail.items), detail.filteringCounts);
      } catch (refreshError) {
        if (!staleRequestId) throw refreshError;
        const staleDetail = await this.root.services.feedApiService.getFeedDetail(staleRequestId);
        if (requestSequence !== this.sequence || this.activeFeed !== feedName) return;
        this.warning =
          "The current feed is older than 10 minutes. Preview changes may include newer posts.";
        this.setBaseline(transformFeedItems(staleDetail.items), staleDetail.filteringCounts);
      }
    } catch (error) {
      if (requestSequence !== this.sequence || this.activeFeed !== feedName) return;
      this.error = error instanceof Error ? error.message : "Could not load the current feed";
    } finally {
      if (requestSequence === this.sequence && this.activeFeed === feedName) {
        this.isLoadingBaseline = false;
      }
    }
  }

  setControl(
    control: FeedControlName,
    value: number | SourceWeights,
    origin?: SourceWeightChangeOrigin,
  ): boolean {
    if (!this.activeFeed || !this.draft) return false;
    const property = CONTROL_PROPERTIES[control];
    const next = clonePreferences(this.draft);
    Object.assign(next, {
      [property]: control === "source_weights" ? { ...(value as SourceWeights) } : value,
    });
    if (valuesEqual(control, next, this.draft)) return false;
    this.draft = next;
    this.activeControl = control;
    if (origin) this.origins[control] = origin;
    this.recomputeDirty();
    return true;
  }

  resetDraftToDefaults(defaults: Preferences, controls: FeedControlName[]): boolean {
    if (!this.draft) return false;
    const next = clonePreferences(this.draft);
    for (const control of controls) {
      const property = CONTROL_PROPERTIES[control];
      Object.assign(next, {
        [property]:
          control === "source_weights" ? { ...defaults.sourceWeights } : defaults[property],
      });
    }
    const changedControls = controls.filter(
      (control) => !valuesEqual(control, next, this.draft as Preferences),
    );
    if (changedControls.length === 0) return false;
    for (const control of changedControls) this.origins[control] = "reset_defaults";
    this.draft = next;
    this.activeControl = controls.at(-1) ?? null;
    this.recomputeDirty();
    return true;
  }

  async preview(): Promise<GeneratedSettingsPreview | null> {
    if (!this.activeFeed || !this.hasDirtyChanges || this.isGenerating) return null;
    const feedName = this.activeFeed;
    const patch = this.dirtyPatch;
    const previewSignature = signature(feedName, patch);
    const requestSequence = ++this.sequence;
    this.isGenerating = true;
    this.error = null;
    try {
      const preview = await this.generatePreview(feedName, patch, previewSignature);
      if (requestSequence !== this.sequence || this.activeFeed !== feedName) return null;
      return preview;
    } catch (error) {
      if (requestSequence === this.sequence && this.activeFeed === feedName) {
        this.error = error instanceof Error ? error.message : "Could not generate a preview";
      }
      return null;
    } finally {
      if (requestSequence === this.sequence && this.activeFeed === feedName) {
        this.isGenerating = false;
      }
    }
  }

  acceptPreview(preview: GeneratedSettingsPreview): void {
    this.displayedItems = preview.items;
    this.displayedFilteringCounts = preview.filteringCounts;
    this.lastPreviewSignature = preview.signature;
    this.lastPreviewRequestId = preview.requestId;
  }

  async save(): Promise<boolean> {
    if (!this.activeFeed || !this.hasDirtyChanges || this.isSaving || this.isGenerating) {
      return !this.hasDirtyChanges;
    }
    const feedName = this.activeFeed;
    const patch = this.dirtyPatch;
    const savedSignature = signature(feedName, patch);
    const requestSequence = ++this.sequence;
    this.isSaving = true;
    this.error = null;
    let acceptedSlate: GeneratedSettingsPreview;
    try {
      acceptedSlate =
        this.lastPreviewSignature === savedSignature && this.lastPreviewRequestId !== null
          ? {
              requestId: this.lastPreviewRequestId,
              items: [...this.displayedItems],
              filteringCounts: { ...this.displayedFilteringCounts },
              signature: savedSignature,
            }
          : await this.generatePreview(feedName, patch, savedSignature);
    } catch {
      if (requestSequence === this.sequence && this.activeFeed === feedName) {
        this.error = "The updated feed could not be generated. Your changes have not been saved.";
      }
      this.isSaving = false;
      return false;
    }

    if (requestSequence !== this.sequence || this.activeFeed !== feedName) {
      this.isSaving = false;
      return false;
    }

    try {
      let accepted;
      try {
        accepted = await this.root.services.feedApiService.acceptFeedPreview(
          feedName,
          acceptedSlate.requestId,
          patch,
          acceptedSlate.items.map((item) => item.atUri),
        );
      } catch (error) {
        if (!(error instanceof FeedApiError) || (error.status !== 404 && error.status !== 409)) {
          throw error;
        }
        acceptedSlate = await this.generatePreview(feedName, patch, savedSignature);
        if (requestSequence !== this.sequence || this.activeFeed !== feedName) return false;
        accepted = await this.root.services.feedApiService.acceptFeedPreview(
          feedName,
          acceptedSlate.requestId,
          patch,
          acceptedSlate.items.map((item) => item.atUri),
        );
      }
      if (requestSequence !== this.sequence || this.activeFeed !== feedName) return false;

      this.root.preferencesStore.applyAcceptedPatch(
        feedName,
        patch,
        accepted.preferences,
        this.origins,
      );
      this.draft = clonePreferences(this.root.preferencesStore.valuesFor(feedName));
      this.dirtyControls = [];
      this.origins = {};
      this.setBaseline(acceptedSlate.items, acceptedSlate.filteringCounts);
      this.lastPreviewSignature = null;
      this.lastPreviewRequestId = null;
      this.warning = null;
      return true;
    } catch {
      if (requestSequence === this.sequence && this.activeFeed === feedName) {
        this.error = "Changes could not be saved. Your draft is still here.";
      }
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  discard(): void {
    if (!this.activeFeed) return;
    this.draft = clonePreferences(this.root.preferencesStore.valuesFor(this.activeFeed));
    this.dirtyControls = [];
    this.origins = {};
    this.displayedItems = this.baselineItems;
    this.displayedFilteringCounts = this.baselineFilteringCounts;
    this.lastPreviewSignature = null;
    this.lastPreviewRequestId = null;
    this.error = null;
  }

  get hasDirtyChanges(): boolean {
    return this.dirtyControls.length > 0;
  }

  get isDisplayingBaseline(): boolean {
    return sameSlate(this.displayedItems, this.baselineItems);
  }

  get dirtyPatch(): FeedPreferences {
    if (!this.draft) return {};
    const patch: FeedPreferences = {};
    for (const control of this.dirtyControls) {
      const property = CONTROL_PROPERTIES[control];
      const value = this.draft[property];
      Object.assign(patch, {
        [property]: control === "source_weights" ? { ...(value as SourceWeights) } : value,
      });
    }
    return patch;
  }

  private setBaseline(items: FeedItemView[], filteringCounts: FilteringCounts): void {
    this.baselineItems = [...items];
    this.displayedItems = [...items];
    this.baselineFilteringCounts = { ...filteringCounts };
    this.displayedFilteringCounts = { ...filteringCounts };
  }

  private async generatePreview(
    feedName: AlgorithmId,
    patch: FeedPreferences,
    previewSignature: string,
  ): Promise<GeneratedSettingsPreview> {
    const session = await this.root.services.feedApiService.createFeedPreview(feedName, patch);
    const detail = await this.root.services.feedApiService.getFeedPreview(session.requestId);
    return {
      requestId: session.requestId,
      items: transformFeedItems(detail.items),
      filteringCounts: detail.filteringCounts,
      signature: previewSignature,
    };
  }

  private recomputeDirty(): void {
    if (!this.activeFeed || !this.draft) return;
    const saved = this.root.preferencesStore.valuesFor(this.activeFeed);
    this.dirtyControls = (Object.keys(CONTROL_PROPERTIES) as FeedControlName[]).filter(
      (control) => !valuesEqual(control, this.draft as Preferences, saved),
    );
  }
}
