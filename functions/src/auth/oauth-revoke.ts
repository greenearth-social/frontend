import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import {
  decryptGrantSecrets,
  isValidDid,
  loadGrant,
  tombstoneRevokedGrant,
} from "./oauth-grants.js";
import { revokeRefreshToken } from "./oauth-revocation.js";

if (getApps().length === 0) {
  initializeApp();
}

export type RevokeOutcome = "revoked" | "already_revoked" | "no_session" | "failed";

/**
 * Never throws. `failed` leaves the stored grant untouched and is safe to retry.
 * A login that replaces the grant while it is being revoked yields `failed` (the
 * newer grant is still live); the retry revokes the newer grant.
 */
export async function revokeGrant(did: string): Promise<RevokeOutcome> {
  try {
    const grant = await loadGrant(did);
    if (!grant) return "no_session";
    if (grant.status === "revoked") return "already_revoked";
    if (!grant.ciphertext || !grant.issuer) {
      console.error("OAuth grant revocation failed", { error: "IncompleteGrant" });
      return "failed";
    }

    const secrets = await decryptGrantSecrets(grant.ciphertext, did);
    const result = await revokeRefreshToken({
      issuer: grant.issuer,
      refreshToken: secrets.refresh_token,
      dpopPrivateJwk: secrets.dpop_private_jwk,
    });
    if (result === "failed") return "failed";

    const write = await tombstoneRevokedGrant(did, grant.ciphertext);
    if (write === "superseded") {
      console.error("OAuth grant revocation failed", { error: "GrantSuperseded" });
      return "failed";
    }
    return result;
  } catch (err: unknown) {
    console.error("OAuth grant revocation failed", {
      error: err instanceof Error ? err.name : "unknown",
    });
    return "failed";
  }
}

export async function oauthRevokeHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const did = (req.body as { did?: unknown } | null | undefined)?.did;
  if (!isValidDid(did)) {
    res.status(400).json({ error: "invalid_did" });
    return;
  }
  res.status(200).json({ outcome: await revokeGrant(did) });
}

const PROJECT = "greenearth-471522";

export const oauthRevoke = onRequest(
  {
    secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY", "OAUTH_SESSION_ENCRYPTION_KEY"],
    invoker: [`api-runner-prod@${PROJECT}.iam.gserviceaccount.com`],
  },
  oauthRevokeHandler,
);

export const oauthRevokeStage = onRequest(
  {
    secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY_STAGE", "OAUTH_SESSION_ENCRYPTION_KEY_STAGE"],
    invoker: [`api-runner-stage@${PROJECT}.iam.gserviceaccount.com`],
  },
  oauthRevokeHandler,
);
