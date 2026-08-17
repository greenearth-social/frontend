import type { AlgorithmId } from "../../constants/algorithms";

export type FeedControlName = "source_weights" | "freshness" | "politics" | "purpose";

export type SignInFailureStage = "validation" | "initiation" | "callback";

export interface AnalyticsEventProperties {
  signInCompleted: {
    auth_method: "bluesky_oauth";
    return_route: string;
  };
  signInFailed: {
    failure_stage: SignInFailureStage;
    error_category:
      | "invalid_handle"
      | "request_failed"
      | "missing_redirect_url"
      | "missing_token"
      | "token_exchange_failed"
      | "access_denied"
      | "provider_error"
      | "callback_failed";
  };
  feedControlChanged: FeedControlEventProperties & FeedAnalyticsProperties;
  feedControlChangeFailed: FeedControlEventProperties &
    FeedAnalyticsProperties & {
      error_category: "preferences_request_failed";
    };
  controlHelpOpened: FeedAnalyticsProperties & {
    control_name: FeedControlName;
  };
  settingsViewed: FeedAnalyticsProperties;
  howItWorksViewed: FeedAnalyticsProperties;
  howItWorksComponentClicked: FeedAnalyticsProperties & {
    component_id: string;
    component_label: string;
    component_type: "source" | "signal" | "penalty" | "config";
  };
  postOpenedInBluesky: {
    item_uri: string;
    feed_name: string;
    final_position: number;
  };
  "survey sent": Record<string, string | number | boolean | null>;
}

export interface FeedAnalyticsProperties {
  feed_name: AlgorithmId;
  feed_label: string;
}

export interface FeedControlEventProperties {
  control_name: FeedControlName;
  change_origin?:
    | "following"
    | "network_likes"
    | "authors_topics"
    | "popular"
    | "source_mix_master"
    | "reset_defaults";
  previous_value?: number;
  new_value?: number;
  previous_label?: string;
  new_label?: string;
  previous_following_weight?: number;
  new_following_weight?: number;
  previous_network_likes_weight?: number;
  new_network_likes_weight?: number;
  previous_authors_topics_weight?: number;
  new_authors_topics_weight?: number;
  previous_popular_weight?: number;
  new_popular_weight?: number;
  previous_hours?: number;
  new_hours?: number;
  previous_engaging_weight?: number;
  new_engaging_weight?: number;
  previous_constructive_weight?: number;
  new_constructive_weight?: number;
}

export interface IAnalyticsService {
  identify(distinctId: string): void;
  reset(): void;
  capture<EventName extends keyof AnalyticsEventProperties>(
    event: EventName,
    properties: AnalyticsEventProperties[EventName],
  ): void;
}
