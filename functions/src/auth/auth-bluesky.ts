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
import {
  BLUESKY_AUTH_SERVER,
  discoverIdentity,
  fetchAuthServerMetadata,
} from "./auth-discovery.js";
import {
  publicHttpsRequest,
  responseHeader,
  type PublicHttpsResponse,
} from "./safe-http.js";

const OAUTH_REQUEST_TIMEOUT_MS = 10_000;
const OAUTH_RESPONSE_LIMIT_BYTES = 64 * 1024;

export async function authBlueskyHandler(req: Request, res: Response): Promise<void> {
  try {
  const appOrigin = process.env.APP_ORIGIN;
  const kid = process.env.BLUESKY_OAUTH_CLIENT_KID;
  const returnUrl = (req.query.return_url as string) || "/";
  const rawHandle = req.query.handle as string | undefined;

  if (!appOrigin) {
    res.status(500).send("APP_ORIGIN not configured");
    return;
  }

  if (!kid) {
    res.status(500).send("BLUESKY_OAUTH_CLIENT_KID not configured");
    return;
  }
  const identity = rawHandle ? await discoverIdentity(rawHandle) : undefined;
  const authServer = identity?.issuer ?? BLUESKY_AUTH_SERVER;
  const discoveredMetadata =
    identity?.authServerMetadata ?? (await fetchAuthServerMetadata(authServer));

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
    authServer,
    clientKey,
    kid,
  );

  // 4. Identity, PDS, and authorization-server metadata were discovered and
  // validated before creating any OAuth session material.
  const authServerMeta = discoveredMetadata;

  const parEndpoint = authServerMeta["pushed_authorization_request_endpoint"];
  const authEndpoint = authServerMeta["authorization_endpoint"];

  if (!parEndpoint || !authEndpoint) {
    res.status(502).send("Auth server missing required endpoints");
    return;
  }

  // 5. Encrypt session state into OAuth state parameter (AEAD)
  const state = await encryptState({
    codeVerifier,
    authServerIssuer: authServer,
    expectedDid: identity?.did,
    handle: identity?.handle,
    pds: identity?.pds,
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
  if (identity) {
    parBody.set("login_hint", identity.handle);
  }

  const parUrl = new URL(parEndpoint);
  const parUrlString = `${parUrl.origin}${parUrl.pathname}`;
  let dpopNonce: string | undefined;
  let parRes = await sendPar(
    parUrlString,
    parBody,
    dpopKeyPair.privateKey,
    dpopPublicJwk,
    dpopNonce,
  );

  // Handle DPoP nonce error (can be 400 or 401)
  let errorBody = "";
  if ((parRes.status < 200 || parRes.status >= 300) && !dpopNonce) {
    errorBody = parRes.body.toString("utf8");
    const nonce = responseHeader(parRes.headers, "dpop-nonce");
    if (nonce && errorBody.includes("use_dpop_nonce")) {
      dpopNonce = nonce;
      parRes = await sendPar(
        parUrlString,
        parBody,
        dpopKeyPair.privateKey,
        dpopPublicJwk,
        dpopNonce,
      );
      errorBody = "";
    }
  }

  if (parRes.status < 200 || parRes.status >= 300) {
    if (!errorBody) {
      errorBody = parRes.body.toString("utf8");
    }
    res.status(502).send(`PAR failed: ${String(parRes.status)} ${errorBody}`);
    return;
  }

  let parData: { request_uri?: string };
  try {
    parData = JSON.parse(parRes.body.toString("utf8")) as { request_uri?: string };
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
  if (req.get("accept")?.includes("application/json")) {
    res.json({ redirectUrl });
  } else {
    res.redirect(redirectUrl);
  }

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

export const authBlueskyStage = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY_STAGE", "OAUTH_STATE_ENCRYPTION_KEY"] },
  authBlueskyHandler
);

async function sendPar(
  url: string,
  body: URLSearchParams,
  dpopPrivateKey: CryptoKey,
  dpopPublicJwk: JsonWebKey,
  nonce?: string,
): Promise<PublicHttpsResponse> {
  const dpopProof = await createDpopProof(
    "POST",
    url,
    dpopPrivateKey,
    dpopPublicJwk,
    nonce,
  );
  return publicHttpsRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
    body,
    timeoutMs: OAUTH_REQUEST_TIMEOUT_MS,
    maxResponseBytes: OAUTH_RESPONSE_LIMIT_BYTES,
  });
}
