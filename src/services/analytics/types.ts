export type FeedControlName =
  | "social_radius"
  | "freshness"
  | "politics"
  | "purpose";

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
      | "token_exchange_failed";
  };
  feedControlChanged: FeedControlEventProperties;
  feedControlChangeFailed: FeedControlEventProperties & {
    error_category: "preferences_request_failed";
  };
  controlHelpOpened: {
    control_name: FeedControlName;
  };
  howItWorksViewed: Record<string, never>;
  howItWorksComponentClicked: {
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

export interface FeedControlEventProperties {
  control_name: FeedControlName;
  previous_value: number;
  new_value: number;
  previous_label: string;
  new_label: string;
  previous_friends_weight?: number;
  new_friends_weight?: number;
  previous_everyone_weight?: number;
  new_everyone_weight?: number;
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
