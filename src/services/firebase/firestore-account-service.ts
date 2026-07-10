import { doc, getDoc, type Firestore } from "firebase/firestore";
import type { UserDocument } from "../../models/bluesky-account";

function userDocId(did: string): string {
  return did.startsWith("did:plc:") ? did.slice(8) : did;
}

export class FirestoreAccountService {
  private getDb: () => Firestore | null;

  constructor(getDb: () => Firestore | null) {
    this.getDb = getDb;
  }

  async getUser(did: string): Promise<UserDocument | null> {
    const db = this.getDb();
    if (!db) return null;

    const docId = userDocId(did);
    const userRef = doc(db, "users", docId);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      userDid: String(data.user_did ?? did),
      username:
        typeof data.username === "string" ? data.username : null,
      debugFeeds: Boolean(data.debug_feeds),
    };
  }
}
