import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";

export const oauthClientMetadata = onRequest((_req: Request, res: Response) => {
  const appOrigin = process.env.APP_ORIGIN;

  if (!appOrigin) {
    res.status(500).json({ error: "APP_ORIGIN not configured" });
    return;
  }

  res.set("Content-Type", "application/json");
  res.json({
    client_id: `${appOrigin}/.well-known/oauth-client-metadata`,
    application_type: "web",
    client_name: "GreenEarth Feed Debug",
    client_uri: appOrigin,
    dpop_bound_access_tokens: true,
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [`${appOrigin}/oauth/callback`],
    response_types: ["code"],
    scope: "atproto",
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    jwks_uri: `${appOrigin}/.well-known/jwks.json`,
  });
});
