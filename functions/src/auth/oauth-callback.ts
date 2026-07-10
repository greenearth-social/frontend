import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { importJWK } from "jose";
import {
  createClientAssertion,
  createDpopProof,
  getClientPrivateKey,
} from "./helpers.js";

const AUTH_SERVER = "https://bsky.social";

if (getApps().length === 0) {
  initializeApp();
}

const auth = getAuth();
const db = getFirestore();

interface PendingOAuthState {
  state: string;
  codeVerifier: string;
  authServerIssuer: string;
  dpopPrivateJwk: string;
  dpopPublicJwk: string;
  dpopNonce: string | null;
  returnUrl: string;
  redirectUri: string;
  createdAt: Date;
  expireAt: Date;
}

export const oauthCallback = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY"] },
  async (req: Request, res: Response) => {
  try {
  const appOrigin = process.env.APP_ORIGIN;
  const kid = process.env.BLUESKY_OAUTH_CLIENT_KID;

  if (!appOrigin) {
    res.status(500).send("APP_ORIGIN not configured");
    return;
  }

  if (!kid) {
    res.status(500).send("BLUESKY_OAUTH_CLIENT_KID not configured");
    return;
  }

  const state = req.query.state as string | undefined;
  const iss = req.query.iss as string | undefined;
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error) {
    res.redirect(`/#/auth/finish?error=${encodeURIComponent(error)}`);
    return;
  }

  if (!state || !iss || !code) {
    res.status(400).send("Missing required callback parameters");
    return;
  }

  // 1. Look up pending state
  const pendingRef = db.collection("pendingOAuthRequests").doc(state);
  const pendingDoc = await pendingRef.get();
  if (!pendingDoc.exists) {
    res.status(400).send("Invalid or expired state");
    return;
  }

  const pending = pendingDoc.data() as PendingOAuthState;

  // 2. Validate iss
  if (pending.authServerIssuer !== iss) {
    res.status(400).send("Issuer mismatch");
    return;
  }

  // 3. Delete pending doc (prevent replay)
  await pendingRef.delete();

  // 4. Discover auth server token endpoint
  let authServerMeta: Record<string, string>;
  try {
    const metaRes = await fetch(
      `${AUTH_SERVER}/.well-known/oauth-authorization-server`,
    );
    if (!metaRes.ok) {
      res.status(502).send("Failed to fetch auth server metadata");
      return;
    }
    authServerMeta = (await metaRes.json()) as Record<string, string>;
  } catch {
    res.status(502).send("Failed to fetch auth server metadata");
    return;
  }

  const tokenEndpoint = authServerMeta["token_endpoint"];
  if (!tokenEndpoint) {
    res.status(502).send("Auth server missing token endpoint");
    return;
  }

  // 5. Exchange code for tokens
  const clientKey = await getClientPrivateKey();
  const clientId = `${appOrigin}/.well-known/oauth-client-metadata`;
  const redirectUri = pending.redirectUri;

  const dpopPrivateJwk = JSON.parse(pending.dpopPrivateJwk) as JsonWebKey;
  const dpopPublicJwk = JSON.parse(pending.dpopPublicJwk) as JsonWebKey;
  const dpopPrivateKey = (await importJWK(dpopPrivateJwk, "ES256")) as CryptoKey;

  const tokenUrl = new URL(tokenEndpoint);
  const tokenUrlString = tokenUrl.origin + tokenUrl.pathname;
  const dpopProof = await createDpopProof(
    "POST",
    tokenUrlString,
    dpopPrivateKey,
    dpopPublicJwk,
    pending.dpopNonce ?? undefined,
  );

  const clientAssertion = await createClientAssertion(
    clientId,
    AUTH_SERVER,
    clientKey,
    kid,
  );

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code: code,
    code_verifier: pending.codeVerifier,
    redirect_uri: redirectUri,
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: clientAssertion,
  });

  let tokenRes = await fetch(tokenUrlString, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
    body: tokenBody,
  });

  // Retry with new DPoP nonce if needed (can be 400 or 401)
  let errorBody = "";
  if (!tokenRes.ok) {
    errorBody = await tokenRes.text().catch(() => "");
    const newNonce = tokenRes.headers.get("dpop-nonce");
    if (newNonce && errorBody.includes("use_dpop_nonce")) {
      const retryDpopProof = await createDpopProof(
        "POST",
        tokenUrlString,
        dpopPrivateKey,
        dpopPublicJwk,
        newNonce,
      );
      tokenRes = await fetch(tokenUrlString, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          DPoP: retryDpopProof,
        },
        body: tokenBody,
      });
      errorBody = "";
    }
  }

  if (!tokenRes.ok) {
    if (!errorBody) {
      errorBody = await tokenRes.text().catch(() => "");
    }
    res.status(502).send(`Token exchange failed: ${String(tokenRes.status)} ${errorBody}`);
    return;
  }

  let tokenData: { access_token?: string; sub?: string };
  try {
    tokenData = (await tokenRes.json()) as {
      access_token?: string;
      sub?: string;
    };
  } catch {
    res.status(502).send("Token response invalid");
    return;
  }

  const did = tokenData.sub;
  if (!did) {
    res.status(502).send("Token response missing sub (DID)");
    return;
  }

  // 6. Mint Firebase custom token
  let firebaseToken: string;
  try {
    firebaseToken = await auth.createCustomToken(did);
  } catch {
    res.status(502).send("Failed to create Firebase custom token");
    return;
  }

  // 7. Redirect to frontend with token (absolute URL to avoid proxy issues)
  const returnUrl = pending.returnUrl || "/";
  const finishUrl = `${appOrigin}/#/auth/finish?token=${encodeURIComponent(firebaseToken)}&return_url=${encodeURIComponent(returnUrl)}`;
  res.redirect(302, finishUrl);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("oauthCallback error:", message, err);
    res.status(500).send(`OAuth callback failed: ${message}`);
  }
});
