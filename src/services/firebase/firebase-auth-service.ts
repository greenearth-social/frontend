import {
  signInWithCustomToken as fbSignInWithCustomToken,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  type User,
} from "firebase/auth";
import type { IAuthService } from "../types";
import { auth } from "./firebase-init";

export class FirebaseAuthService implements IAuthService {
  get currentUser(): { uid: string; email: string | null; displayName: string | null } | null {
    const user = auth.currentUser;
    if (!user) return null;
    return { uid: user.uid, email: user.email, displayName: user.displayName };
  }

  async signInWithCustomToken(token: string): Promise<void> {
    await fbSignInWithCustomToken(auth, token);
  }

  async signOut(): Promise<void> {
    await fbSignOut(auth);
  }

  async getIdToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    return user.getIdToken();
  }

  onAuthStateChanged(
    callback: (user: { uid: string; email: string | null; displayName: string | null } | null) => void,
  ): () => void {
    return fbOnAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        callback({ uid: user.uid, email: user.email, displayName: user.displayName });
      } else {
        callback(null);
      }
    });
  }
}
