import type { FeedbackSurface } from "../config/runtime-config";
import { ALGORITHMS, type AlgorithmId } from "../constants/algorithms";
import type { FeedbackSnapshotContext, FeedbackSubmitResult } from "../services/feedback/types";
import type { RootStore } from "./root-store";

export class FeedbackStore {
  constructor(private root: RootStore) {}

  get mode() {
    return this.root.services.feedbackService.mode;
  }

  get unavailableReason() {
    return this.root.services.feedbackService.unavailableReason;
  }

  unavailableReasonFor(surface: FeedbackSurface): string | null {
    return this.root.services.feedbackService.unavailableReasonFor(surface);
  }

  submit(
    surface: FeedbackSurface,
    response: string,
    feedName: AlgorithmId,
  ): Promise<FeedbackSubmitResult> {
    const user = this.root.authStore.currentUser;
    if (!user) return Promise.reject(new Error("Sign in to send feedback."));

    const currentRequestId = this.root.feedStore.currentRequestId;
    const currentSummary = currentRequestId
      ? this.root.feedStore.feedList.find((feed) => feed.requestId === currentRequestId)
      : undefined;
    const requestId = currentSummary?.feedName === feedName ? currentRequestId : null;
    const summary = requestId
      ? this.root.feedStore.feedList.find((feed) => feed.requestId === requestId)
      : undefined;
    const filtering = requestId
      ? this.root.feedStore.filteringCountsByRequest[requestId]
      : undefined;
    const latestSummaryForFeed = this.root.feedStore.feedList
      .filter((feed) => feed.feedName === feedName)
      .reduce<(typeof this.root.feedStore.feedList)[number] | undefined>(
        (latest, feed) => (!latest || feed.generatedAt > latest.generatedAt ? feed : latest),
        undefined,
      );
    const apiReleaseSha =
      (requestId ? summary?.apiReleaseSha : latestSummaryForFeed?.apiReleaseSha) ?? null;
    const snapshot: FeedbackSnapshotContext | null =
      requestId && summary && filtering
        ? {
            requestId,
            feedName: summary.feedName,
            generatedAt: summary.generatedAt,
            storedItemCount: filtering.storedItemCount,
            displayedItemCount: filtering.displayedItemCount,
            publiclyFilteredCount: filtering.publiclyFilteredCount,
            unavailableCount: filtering.unavailableCount,
          }
        : null;
    const route = window.location.hash.slice(1).split("?")[0] || "/feed";

    return this.root.services.feedbackService.submit({
      submissionId: globalThis.crypto.randomUUID(),
      distinctId: user.uid,
      surface,
      response,
      appRoute: route,
      feedName,
      feedLabel: ALGORITHMS[feedName].label,
      apiReleaseSha,
      preferences: { ...this.root.preferencesStore.valuesFor(feedName) },
      snapshot,
    });
  }
}
