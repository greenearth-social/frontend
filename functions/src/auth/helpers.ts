import { SignJWT, importJWK, exportJWK } from "jose";
import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Token / key helpers
// ---------------------------------------------------------------------------

export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64url")
    .replace(/=+$/, "");
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(hash)
    .toString("base64url")
    .replace(/=+$/, "");
}

export function generateDpopKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
}

export async function exportPublicJwk(key: CryptoKey): Promise<JsonWebKey> {
  const jwk = await exportJWK(key);
  return { ...jwk, alg: "ES256", use: "sig" };
}

export async function exportPrivateJwk(key: CryptoKey): Promise<JsonWebKey> {
  const jwk = await exportJWK(key);
  return { ...jwk, alg: "ES256" };
}

// ---------------------------------------------------------------------------
// Client assertion JWT  (used for PAR and token exchange)
// ---------------------------------------------------------------------------

export async function createClientAssertion(
  clientId: string,
  authServerIssuer: string,
  privateKey: CryptoKey,
  kid: string,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", typ: "jwt", kid })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(authServerIssuer)
    .setJti(generateToken())
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .sign(privateKey);
}

// ---------------------------------------------------------------------------
// DPoP proof JWT
// ---------------------------------------------------------------------------

export async function createDpopProof(
  method: string,
  url: string,
  privateKey: CryptoKey,
  publicJwk: JsonWebKey,
  nonce?: string,
  accessTokenHash?: string,
): Promise<string> {
  const payload: Record<string, unknown> = {
    jti: generateToken(),
    htm: method,
    htu: url,
    iat: Math.floor(Date.now() / 1000),
  };

  if (nonce) payload.nonce = nonce;
  if (accessTokenHash) payload.ath = accessTokenHash;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk: publicJwk })
    .sign(privateKey);
}

// ---------------------------------------------------------------------------
// Import the stored ES256 client private key (file in dev, env var in prod)
// ---------------------------------------------------------------------------

let cachedClientKey: CryptoKey | null = null;

async function loadKeyJson(): Promise<string> {
  const envVar = process.env.BLUESKY_OAUTH_CLIENT_PRIVATE_KEY;
  if (envVar) return envVar;
  return readFile("./keys/private-key.json", "utf-8");
}

export async function getClientPrivateKey(): Promise<CryptoKey> {
  if (cachedClientKey) return cachedClientKey;

  const raw = await loadKeyJson();
  const jwk = JSON.parse(raw) as JsonWebKey;
  cachedClientKey = (await importJWK(jwk, "ES256")) as CryptoKey;
  return cachedClientKey;
}
