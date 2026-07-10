import {
  signInWithCustomToken as fbSignInWithCustomToken,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  type User,
} from "firebase/auth";
import type { IAuthService } from "../types";
import { auth } from "./firebase-init";

export class FirebaseAuthService implements IAuthService {
  get currentUser(): { uid: string; email: string | null } | null {
    const user = auth.currentUser;
    if (!user) return null;
    return { uid: user.uid, email: user.email };
  }

  async signInWithCustomToken(token: string): Promise<void> {
    await fbSignInWithCustomToken(auth, token);
  }

  async signOut(): Promise<void> {
    await fbSignOut(auth);
  }

  onAuthStateChanged(
    callback: (user: { uid: string; email: string | null } | null) => void,
  ): () => void {
    return fbOnAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        callback({ uid: user.uid, email: user.email });
      } else {
        callback(null);
      }
    });
  }
}
