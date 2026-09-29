import { importJWK } from "jose";
import { createClientAssertion, createDpopProof, getClientPrivateKey } from "./helpers.js";
import { fetchAuthServerMetadata } from "./auth-discovery.js";
import { parsePublicHttpsUrl, publicHttpsRequest, responseHeader } from "./safe-http.js";

const TIMEOUT_MS = 10_000;
const LIMIT_BYTES = 64 * 1024;
const LOGGABLE_ERROR_CODE = /^[a-z_]{1,64}$/;

export type RevokeResult = "revoked" | "already_revoked" | "failed";

export interface RevokeInput {
  issuer: string;
  refreshToken: string;
  dpopPrivateJwk: JsonWebKey;
}

function publicJwkOf(privateJwk: JsonWebKey): JsonWebKey {
  const { kty, crv, x, y } = privateJwk;
  return { kty, crv, x, y, alg: "ES256", use: "sig" };
}

function errorCode(body: Buffer): string {
  try {
    const parsed = JSON.parse(body.toString("utf8")) as { error?: unknown };
    return typeof parsed.error === "string" ? parsed.error : "";
  } catch {
    return "";
  }
}

export async function revokeRefreshToken(input: RevokeInput): Promise<RevokeResult> {
  try {
    const appOrigin = process.env.APP_ORIGIN;
    const kid = process.env.BLUESKY_OAUTH_CLIENT_KID;
    if (!appOrigin || !kid) throw new Error("OAuth client not configured");

    const meta = (await fetchAuthServerMetadata(input.issuer)) as unknown as Record<
      string,
      unknown
    >;
    const endpoint = meta["revocation_endpoint"];
    if (typeof endpoint !== "string") {
      throw new Error("Authorization server has no revocation_endpoint");
    }
    const url = parsePublicHttpsUrl(endpoint);
    const urlString = `${url.origin}${url.pathname}`;

    const clientId = `${appOrigin}/.well-known/oauth-client-metadata`;
    const clientKey = await getClientPrivateKey();
    const dpopKey = (await importJWK(input.dpopPrivateJwk, "ES256")) as CryptoKey;
    const dpopPublic = publicJwkOf(input.dpopPrivateJwk);

    const send = async (nonce?: string) => {
      const assertion = await createClientAssertion(clientId, input.issuer, clientKey, kid);
      const body = new URLSearchParams({
        client_id: clientId,
        token: input.refreshToken,
        token_type_hint: "refresh_token",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
      });
      return publicHttpsRequest(urlString, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          DPoP: await createDpopProof("POST", urlString, dpopKey, dpopPublic, nonce),
        },
        body,
        timeoutMs: TIMEOUT_MS,
        maxResponseBytes: LIMIT_BYTES,
      });
    };

    let res = await send();
    const nonce = responseHeader(res.headers, "dpop-nonce");
    if (res.status >= 400 && nonce && errorCode(res.body) === "use_dpop_nonce") {
      res = await send(nonce);
    }

    if (res.status >= 200 && res.status < 300) return "revoked";
    const code = errorCode(res.body);
    if (code === "invalid_grant" || code === "invalid_token") return "already_revoked";
    console.error("Token revocation rejected", {
      status: res.status,
      code: LOGGABLE_ERROR_CODE.test(code) ? code : "unrecognized",
    });
    return "failed";
  } catch (err: unknown) {
    console.error("Token revocation failed", {
      error: err instanceof Error ? err.name : "unknown",
    });
    return "failed";
  }
}
