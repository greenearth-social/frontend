import type { IHydrationService, HydratedPostResult } from "../types";

export class CloudFunctionHydrationService implements IHydrationService {
  hydratePosts(_uris: string[]): Promise<Map<string, HydratedPostResult>> {
    throw new Error("Not implemented yet");
  }
}
