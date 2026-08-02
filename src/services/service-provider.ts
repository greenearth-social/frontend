import type { IAuthService, IFeedApiService } from "./types";
import type { IFeedbackService } from "./feedback/types";
import type { IAnalyticsService } from "./analytics/types";

export interface ServiceProvider {
  authService: IAuthService;
  feedApiService: IFeedApiService;
  analyticsService: IAnalyticsService;
  feedbackService: IFeedbackService;
}
