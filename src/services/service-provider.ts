import type { IAuthService, IFeedApiService } from "./types";

export interface ServiceProvider {
  authService: IAuthService;
  feedApiService: IFeedApiService;
}
