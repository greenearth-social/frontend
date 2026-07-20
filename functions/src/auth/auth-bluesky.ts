import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import {
  generateToken,
  createCodeChallenge,
  generateDpopKeyPair,
  exportPublicJwk,
  exportPrivateJwk,
  createClientAssertion,
  createDpopProof,
  getClientPrivateKey,
  encryptState,
} from "./helpers.js";

const AUTH_SERVER = "https://bsky.social";

export async function authBlueskyHandler(req: Request, res: Response): Promise<void> {
  try {
  const appOrigin = process.env.APP_ORIGIN;
  const kid = process.env.BLUESKY_OAUTH_CLIENT_KID;
  const returnUrl = (req.query.return_url as string) || "/";

  if (!appOrigin) {
    res.status(500).send("APP_ORIGIN not configured");
    return;
  }

  if (!kid) {
    res.status(500).send("BLUESKY_OAUTH_CLIENT_KID not configured");
    return;
  }

  // 1. PKCE
  const codeVerifier = generateToken(48);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  // 2. DPoP key pair
  const dpopKeyPair = await generateDpopKeyPair();
  const dpopPublicJwk = await exportPublicJwk(dpopKeyPair.publicKey);

  // 3. Client assertion for PAR
  const clientKey = await getClientPrivateKey();
  const clientId = `${appOrigin}/.well-known/oauth-client-metadata`;
  const redirectUri = `${appOrigin}/oauth/callback`;
  const clientAssertion = await createClientAssertion(
    clientId,
    AUTH_SERVER,
    clientKey,
    kid,
  );

  // 4. Discover auth server metadata
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

  const parEndpoint = authServerMeta["pushed_authorization_request_endpoint"];
  const authEndpoint = authServerMeta["authorization_endpoint"];

  if (!parEndpoint || !authEndpoint) {
    res.status(502).send("Auth server missing required endpoints");
    return;
  }

  // 5. Encrypt session state into OAuth state parameter (AEAD)
  const state = await encryptState({
    codeVerifier,
    authServerIssuer: AUTH_SERVER,
    dpopPrivateJwk: JSON.stringify(
      await exportPrivateJwk(dpopKeyPair.privateKey),
    ),
    dpopPublicJwk: JSON.stringify(dpopPublicJwk),
    returnUrl,
    redirectUri,
  });

  // 6. Send PAR request (with DPoP nonce retry)
  const parBody = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    redirect_uri: redirectUri,
    scope: "atproto",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: clientAssertion,
  });

  const parUrl = new URL(parEndpoint);
  let dpopNonce: string | undefined;
  let parRes: globalThis.Response = await sendPar(
    parUrl.origin + parUrl.pathname,
    parBody,
    dpopKeyPair.privateKey,
    dpopPublicJwk,
    dpopNonce,
  );

  // Handle DPoP nonce error (can be 400 or 401)
  let errorBody = "";
  if (!parRes.ok && !dpopNonce) {
    errorBody = await parRes.text().catch(() => "");
    const nonce = parRes.headers.get("dpop-nonce");
    if (nonce && errorBody.includes("use_dpop_nonce")) {
      dpopNonce = nonce;
      parRes = await sendPar(
        parUrl.origin + parUrl.pathname,
        parBody,
        dpopKeyPair.privateKey,
        dpopPublicJwk,
        dpopNonce,
      );
      errorBody = "";
    }
  }

  if (!parRes.ok) {
    if (!errorBody) {
      errorBody = await parRes.text().catch(() => "");
    }
    res.status(502).send(`PAR failed: ${String(parRes.status)} ${errorBody}`);
    return;
  }

  let parData: { request_uri?: string };
  try {
    parData = (await parRes.json()) as { request_uri?: string };
  } catch {
    res.status(502).send("PAR response invalid");
    return;
  }

  const requestUri = parData.request_uri;
  if (!requestUri) {
    res.status(502).send("PAR response missing request_uri");
    return;
  }

  // 7. Redirect to authorization endpoint
  const redirectUrl =
    `${authEndpoint}?client_id=${encodeURIComponent(clientId)}` +
    `&request_uri=${encodeURIComponent(requestUri)}`;
  res.redirect(redirectUrl);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("authBluesky error:", message, err);
    res.status(500).send(`OAuth start failed: ${message}`);
  }
}

export const authBluesky = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY", "OAUTH_STATE_ENCRYPTION_KEY"] },
  authBlueskyHandler
);

async function sendPar(
  url: string,
  body: URLSearchParams,
  dpopPrivateKey: CryptoKey,
  dpopPublicJwk: JsonWebKey,
  nonce?: string,
): Promise<globalThis.Response> {
  const dpopProof = await createDpopProof(
    "POST",
    url,
    dpopPrivateKey,
    dpopPublicJwk,
    nonce,
  );
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
    body,
  });
}
