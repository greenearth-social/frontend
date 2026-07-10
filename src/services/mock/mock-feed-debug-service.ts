import type { FeedDebugDocument } from "../../models/feed-debug-snapshot";
import type { IFeedDebugService } from "../types";
import sampleFixture from "../../test/fixtures/sample-feed-debug.json";

export class MockFeedDebugService implements IFeedDebugService {
  async loadLatestSnapshot(_did: string): Promise<FeedDebugDocument> {
    await new Promise((r) => setTimeout(r, 300));
    return sampleFixture;
  }

  async triggerSnapshot(_did: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 300));
    return sampleFixture.requestId;
  }
}
