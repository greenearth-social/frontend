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

// These connections are made by the browser, not the dev server, so they name
// host ports. They are overridable because the shared dev environment can run
// several independent instances side by side, each with its own emulator suite
// on its own ports (api#283); hardcoding them would point every instance's
// page at whichever one happens to own 8080/9099. The defaults are the
// standard emulator ports, so a single-instance setup needs no configuration.
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
// Auth takes a URL and Firestore takes host/port separately, hence the types.
const authPort = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || "9099";
const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080;

if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:${authPort}`, {
    disableWarnings: true,
  });
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
  connectFirestoreEmulator(_db, emulatorHost, firestorePort);
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
