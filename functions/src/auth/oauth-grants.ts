import { getFirestore } from "firebase-admin/firestore";
import { revokeRefreshToken } from "./oauth-revocation.js";

export const OAUTH_GRANTS_COLLECTION = "oauth_grants";
const DID_RE = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/;
const MAX_DID_LENGTH = 2048;
const IV_BYTES = 12;

export interface GrantSecrets {
  refresh_token: string;
  dpop_private_jwk: JsonWebKey;
}

export interface GrantDoc {
  did: string;
  status: "active" | "revoked";
  issuer?: string;
  scope?: string;
  ciphertext?: string;
  created_at?: Date;
  updated_at?: Date;
  revoked_at?: Date;
}

function sessionKeyHex(): string {
  const value =
    process.env.OAUTH_SESSION_ENCRYPTION_KEY || process.env.OAUTH_SESSION_ENCRYPTION_KEY_STAGE;
  if (!value) throw new Error("OAUTH_SESSION_ENCRYPTION_KEY not configured");
  return value;
}

async function sessionKey(): Promise<CryptoKey> {
  const hex = sessionKeyHex();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("OAUTH_SESSION_ENCRYPTION_KEY must be 32 bytes of hex");
  }
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(Buffer.from(hex, "hex")),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptGrantSecrets(secrets: GrantSecrets, did: string): Promise<string> {
  const key = await sessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(did) },
    key,
    new TextEncoder().encode(JSON.stringify(secrets)),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(combined).toString("base64url");
}

export async function decryptGrantSecrets(blob: string, did: string): Promise<GrantSecrets> {
  const key = await sessionKey();
  const combined = new Uint8Array(Buffer.from(blob, "base64url"));
  if (combined.length <= IV_BYTES) throw new Error("Malformed grant ciphertext");
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: combined.slice(0, IV_BYTES),
      additionalData: new TextEncoder().encode(did),
    },
    key,
    combined.slice(IV_BYTES),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as GrantSecrets;
}

export function grantDatabaseId(): string {
  return (
    process.env.GE_FIRESTORE_DATABASE ||
    (process.env.OAUTH_SESSION_ENCRYPTION_KEY ? "greenearth-prod" : "greenearth-stage")
  );
}

function grantRef(did: string) {
  if (did.length > MAX_DID_LENGTH || !DID_RE.test(did)) throw new Error("Malformed DID");
  return getFirestore(grantDatabaseId()).collection(OAUTH_GRANTS_COLLECTION).doc(did);
}

export async function loadGrant(did: string): Promise<GrantDoc | null> {
  const snap = await grantRef(did).get();
  return snap.exists ? (snap.data() as GrantDoc) : null;
}

export async function saveActiveGrant(input: {
  did: string;
  issuer: string;
  scope: string;
  secrets: GrantSecrets;
}): Promise<void> {
  const ref = grantRef(input.did);
  const ciphertext = await encryptGrantSecrets(input.secrets, input.did);
  const now = new Date();
  await ref.set({
    did: input.did,
    status: "active",
    issuer: input.issuer,
    scope: input.scope,
    ciphertext,
    created_at: now,
    updated_at: now,
  });
}

export async function saveTombstone(did: string): Promise<void> {
  await grantRef(did).set({ did, status: "revoked", revoked_at: new Date() });
}

export async function persistLoginGrant(input: {
  did: string;
  issuer: string;
  scope: string;
  refreshToken: string;
  dpopPrivateJwk: JsonWebKey;
}): Promise<boolean> {
  try {
    const existing = await loadGrant(input.did);
    if (existing?.status === "active" && existing.ciphertext && existing.issuer) {
      try {
        const old = await decryptGrantSecrets(existing.ciphertext, input.did);
        await revokeRefreshToken({
          issuer: existing.issuer,
          refreshToken: old.refresh_token,
          dpopPrivateJwk: old.dpop_private_jwk,
        });
      } catch (err: unknown) {
        console.error("Previous OAuth grant could not be revoked", {
          error: err instanceof Error ? err.name : "unknown",
        });
      }
    }
    await saveActiveGrant({
      did: input.did,
      issuer: input.issuer,
      scope: input.scope,
      secrets: { refresh_token: input.refreshToken, dpop_private_jwk: input.dpopPrivateJwk },
    });
    return true;
  } catch (err: unknown) {
    console.error("OAuth grant persistence failed", {
      error: err instanceof Error ? err.name : "unknown",
    });
    await revokeRefreshToken({
      issuer: input.issuer,
      refreshToken: input.refreshToken,
      dpopPrivateJwk: input.dpopPrivateJwk,
    }).catch(() => undefined);
    return false;
  }
}
