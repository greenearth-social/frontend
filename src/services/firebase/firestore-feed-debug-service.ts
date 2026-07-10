import {
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  getDocs,
} from "firebase/firestore";
import type { FeedDebugDocument } from "../../models/feed-debug-snapshot";
import { mapFeedDebugDocument } from "../../models/firestore-mapper";
import type { IFeedDebugService } from "../types";
import { getDb } from "./firebase-init";
import { FirestoreAccountService } from "./firestore-account-service";

const accountService = new FirestoreAccountService(getDb);

function userDocId(did: string): string {
  return did.startsWith("did:plc:") ? did.slice(8) : did;
}

export class FirestoreFeedDebugService implements IFeedDebugService {
  async loadLatestSnapshot(did: string): Promise<FeedDebugDocument | null> {
    const db = getDb();
    if (!db) return null;

    const docId = userDocId(did);

    const user = await accountService.getUser(did);
    if (user && !user.debugFeeds) {
      return null;
    }

    const feedDebugRef = collection(db, "users", docId, "feed_debug");
    const q = query(
      feedDebugRef,
      orderBy("generated_at", "desc"),
      firestoreLimit(20),
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    for (const doc of snapshot.docs) {
      const raw = doc.data() as Record<string, unknown>;
      const mapped = mapFeedDebugDocument(raw);
      if (mapped.feedName === "your-feed") {
        return mapped;
      }
    }

    return null;
  }

  triggerSnapshot(_did: string): Promise<string | null> {
    throw new Error("Not implemented yet — use backend API trigger");
  }
}
