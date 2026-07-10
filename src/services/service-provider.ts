import type { IAuthService, IFeedDebugService, IHydrationService } from "./types";

export interface ServiceProvider {
  authService: IAuthService;
  feedDebugService: IFeedDebugService;
  hydrationService: IHydrationService;
}
