import { onRequest } from "firebase-functions/v2/https";
import { authBlueskyHandler } from "./auth/auth-bluesky.js";
import { oauthCallbackHandler } from "./auth/oauth-callback.js";

export { oauthClientMetadata } from "./auth/oauth-client-metadata.js";
export { oauthJwks } from "./auth/oauth-jwks.js";
export { authBluesky } from "./auth/auth-bluesky.js";
export { oauthCallback } from "./auth/oauth-callback.js";

// Stage variants — same handler logic, isolated by function name and stage-specific secrets
export { oauthClientMetadata as oauthClientMetadataStage } from "./auth/oauth-client-metadata.js";
export { oauthJwks as oauthJwksStage } from "./auth/oauth-jwks.js";

export const authBlueskyStage = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY_STAGE", "OAUTH_STATE_ENCRYPTION_KEY"] },
  authBlueskyHandler
);

export const oauthCallbackStage = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY_STAGE", "OAUTH_STATE_ENCRYPTION_KEY"] },
  oauthCallbackHandler
);
