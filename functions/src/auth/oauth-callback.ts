import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { importJWK } from "jose";
import {
  createClientAssertion,
  createDpopProof,
  getClientPrivateKey,
  decryptState,
} from "./helpers.js";

const AUTH_SERVER = "https://bsky.social";

if (getApps().length === 0) {
  initializeApp();
}

const auth = getAuth();

interface OAuthSessionState {
  codeVerifier: string;
  authServerIssuer: string;
  dpopPrivateJwk: string;
  dpopPublicJwk: string;
  returnUrl: string;
  redirectUri: string;
}

export async function oauthCallbackHandler(req: Request, res: Response): Promise<void> {
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

  // 1. Decrypt and authenticate the OAuth session state
  let session: OAuthSessionState;
  try {
    session = await decryptState<OAuthSessionState>(state);
  } catch {
    res.status(400).send("Invalid or tampered state parameter");
    return;
  }

  // 2. Validate iss matches known auth server
  if (session.authServerIssuer !== iss || iss !== AUTH_SERVER) {
    res.status(400).send("Issuer mismatch");
    return;
  }

  // 3. Discover auth server token endpoint
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

  // 4. Exchange code for tokens
  const clientKey = await getClientPrivateKey();
  const clientId = `${appOrigin}/.well-known/oauth-client-metadata`;
  const redirectUri = session.redirectUri;

  const dpopPrivateJwk = JSON.parse(session.dpopPrivateJwk) as JsonWebKey;
  const dpopPublicJwk = JSON.parse(session.dpopPublicJwk) as JsonWebKey;
  const dpopPrivateKey = (await importJWK(dpopPrivateJwk, "ES256")) as CryptoKey;

  const tokenUrl = new URL(tokenEndpoint);
  const tokenUrlString = tokenUrl.origin + tokenUrl.pathname;
  const dpopProof = await createDpopProof(
    "POST",
    tokenUrlString,
    dpopPrivateKey,
    dpopPublicJwk,
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
    code_verifier: session.codeVerifier,
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

  // 5. Mint Firebase custom token
  let firebaseToken: string;
  try {
    firebaseToken = await auth.createCustomToken(did);
  } catch {
    res.status(502).send("Failed to create Firebase custom token");
    return;
  }

  // 5b. Resolve DID to handle and display name, set on Firebase user
  try {
    const plcRes = await fetch(`https://plc.directory/${did}`);
    console.log("PLC resolve status:", plcRes.status);
    if (plcRes.ok) {
      const plcDoc = (await plcRes.json()) as { alsoKnownAs?: string[] };
      const handle = plcDoc.alsoKnownAs?.[0]?.replace("at://", "");
      console.log("Resolved handle:", handle);
      if (handle) {
        const profileRes = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`,
        );
        console.log("Profile resolve status:", profileRes.status);
        let displayName = handle;
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as { displayName?: string };
          displayName = profile.displayName || handle;
          console.log("Resolved displayName:", displayName);
        }
        try {
          await auth.updateUser(did, { displayName: `${displayName}|${handle}` });
          console.log("updateUser success for", did);
        } catch (err: unknown) {
          const code = (err as { code?: string }).code;
          console.log("updateUser failed:", code, String(err));
          if (code === "auth/user-not-found") {
            await auth.createUser({ uid: did, displayName: `${displayName}|${handle}` });
            console.log("createUser success for", did);
          }
        }
      }
    }
  } catch (err: unknown) {
    console.error("Profile resolution error:", String(err));
  }

  // 6. Redirect to frontend with token
  const returnUrl = session.returnUrl || "/";
  const finishUrl = `${appOrigin}/#/auth/finish?token=${encodeURIComponent(firebaseToken)}&return_url=${encodeURIComponent(returnUrl)}`;
  res.redirect(302, finishUrl);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("oauthCallback error:", message, err);
    res.status(500).send(`OAuth callback failed: ${message}`);
  }
}

export const oauthCallback = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY", "OAUTH_STATE_ENCRYPTION_KEY"] },
  oauthCallbackHandler
);

export const oauthCallbackStage = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY_STAGE", "OAUTH_STATE_ENCRYPTION_KEY"] },
  oauthCallbackHandler
);
