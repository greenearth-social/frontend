import type { IHydrationService } from "../types";

export class CloudFunctionHydrationService implements IHydrationService {
  hydratePosts(
    _uris: string[],
  ): Promise<Map<string, { text: string; authorHandle: string }>> {
    throw new Error("Not implemented yet");
  }
}
