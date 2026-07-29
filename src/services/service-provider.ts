import type { IAuthService, IFeedApiService } from "./types";
import type { IFeedbackService } from "./feedback/types";

export interface ServiceProvider {
  authService: IAuthService;
  feedApiService: IFeedApiService;
  feedbackService: IFeedbackService;
}
