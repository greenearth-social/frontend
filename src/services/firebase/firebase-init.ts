import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(app);

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

// ---------------------------------------------------------------------------
// Firestore is lazily initialized with a runtime database name from
// /config.json. The module-level db below is the emulator default.
// When not using emulators, call initFirestore(databaseId) after loading
// runtime config.
// ---------------------------------------------------------------------------

let _db: Firestore | null = null;
let _dbName = "";

if (useEmulators) {
  _db = getFirestore(app);
  _dbName = "(default)";
  connectFirestoreEmulator(_db, "127.0.0.1", 8080);
}

export function initFirestore(databaseId: string): Firestore {
  if (_db && _dbName === databaseId) return _db;
  if (!useEmulators) {
    _db = getFirestore(app, databaseId);
    _dbName = databaseId;
  }
  return _db as Firestore;
}

export function getDb(): Firestore | null {
  return _db;
}

export { app, auth };
