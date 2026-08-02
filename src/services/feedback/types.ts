import type { FeedbackSurface } from "../../config/runtime-config";
import type { Preferences } from "../types";

export type FeedbackMode = "posthog" | "test" | "unavailable";

export interface FeedbackSnapshotContext {
  requestId: string;
  feedName: string;
  generatedAt: string;
  apiReleaseSha: string | null;
  storedItemCount: number;
  displayedItemCount: number;
  publiclyFilteredCount: number;
  unavailableCount: number;
}

export interface FeedbackSubmission {
  distinctId: string;
  surface: FeedbackSurface;
  response: string;
  appRoute: string;
  preferences: Preferences;
  snapshot: FeedbackSnapshotContext | null;
}

export interface FeedbackEventPayload {
  event: "survey sent";
  distinct_id: string;
  properties: Record<string, string | number | boolean | null>;
}

export interface FeedbackSubmitResult {
  sent: boolean;
  payload: FeedbackEventPayload;
}

export interface IFeedbackService {
  readonly mode: FeedbackMode;
  readonly unavailableReason: string | null;
  unavailableReasonFor(surface: FeedbackSurface): string | null;
  submit(submission: FeedbackSubmission): Promise<FeedbackSubmitResult>;
}
