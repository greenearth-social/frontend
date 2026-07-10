import type { IHydrationService } from "../types";

export class MockHydrationService implements IHydrationService {
  async hydratePosts(
    uris: string[],
  ): Promise<Map<string, { text: string; authorHandle: string }>> {
    await new Promise((r) => setTimeout(r, 200));
    const map = new Map<string, { text: string; authorHandle: string }>();
    for (const uri of uris) {
      map.set(uri, {
        text: `Mock hydrated text for ${uri}`,
        authorHandle: "mock.user.bsky.social",
      });
    }
    return map;
  }
}
