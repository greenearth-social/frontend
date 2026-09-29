import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicHttpsResponse } from "../../functions/src/auth/safe-http";

const edge = vi.hoisted(() => ({
  ISSUER: "https://pds.example",
  DID: "did:plc:abc123",
  dpopPrivateJwk: {} as JsonWebKey,
  dpopPublicJwk: {} as JsonWebKey,
  request: vi.fn<() => Promise<PublicHttpsResponse>>(),
  persist: vi.fn<(input: Record<string, unknown>) => Promise<boolean>>(),
  createCustomToken: vi.fn<(uid: string) => Promise<string>>(),
}));

vi.mock("../../functions/src/auth/helpers", () => ({
  decryptState: () =>
    Promise.resolve({
      codeVerifier: "verifier",
      authServerIssuer: edge.ISSUER,
      expectedDid: edge.DID,
      dpopPrivateJwk: JSON.stringify(edge.dpopPrivateJwk),
      dpopPublicJwk: JSON.stringify(edge.dpopPublicJwk),
      returnUrl: "/",
      redirectUri: "https://app.greenearth.social/oauth/callback",
    }),
  getClientPrivateKey: () => Promise.resolve({}),
  createClientAssertion: () => Promise.resolve("client-assertion"),
  createDpopProof: () => Promise.resolve("dpop-proof"),
}));

vi.mock("../../functions/src/auth/auth-discovery", () => ({
  fetchAuthServerMetadata: () => Promise.resolve({ token_endpoint: `${edge.ISSUER}/oauth/token` }),
  assertOAuthIdentityMatch: (_issuer: string, _iss: string, expected: string, actual: string) => {
    if (expected !== actual) throw new Error("OAuth account did not match");
  },
  discoverAuthorizationServerForDid: () => Promise.reject(new Error("not expected")),
}));

vi.mock("../../functions/src/auth/safe-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../functions/src/auth/safe-http")>();
  return { ...actual, publicHttpsRequest: edge.request };
});

vi.mock("../../functions/src/auth/oauth-grants", () => ({
  persistLoginGrant: edge.persist,
}));

vi.mock("../../functions/node_modules/firebase-admin/lib/esm/app/index.js", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
}));

vi.mock("../../functions/node_modules/firebase-admin/lib/esm/auth/index.js", () => ({
  getAuth: () => ({
    createCustomToken: edge.createCustomToken,
    updateUser: () => Promise.resolve(),
    createUser: () => Promise.resolve(),
  }),
}));

import {
  oauthCallbackHandler,
  oauthFailureRedirectPath,
} from "../../functions/src/auth/oauth-callback";

type CallbackRequest = Parameters<typeof oauthCallbackHandler>[0];
type CallbackResponse = Parameters<typeof oauthCallbackHandler>[1];

function makeResponse(): {
  response: CallbackResponse;
  redirect: ReturnType<typeof vi.fn<(status: number, path: string) => void>>;
} {
  const redirect = vi.fn<(status: number, path: string) => void>();
  const response = {
    headersSent: false,
    redirect,
  } as unknown as CallbackResponse;
  return { response, redirect };
}

describe("OAuth callback failure redirects", () => {
  beforeEach(() => {
    process.env.APP_ORIGIN = "https://app.greenearth.social";
    process.env.BLUESKY_OAUTH_CLIENT_KID = "test-kid";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.APP_ORIGIN;
    delete process.env.BLUESKY_OAUTH_CLIENT_KID;
  });

  it("builds only bounded frontend failure URLs", () => {
    expect(oauthFailureRedirectPath("access_denied")).toBe("/#/auth/finish?error=access_denied");
    expect(oauthFailureRedirectPath("provider_error")).toBe("/#/auth/finish?error=provider_error");
    expect(oauthFailureRedirectPath("callback_failed")).toBe(
      "/#/auth/finish?error=callback_failed",
    );
  });

  it("preserves cancellation without forwarding provider descriptions", async () => {
    const { response, redirect } = makeResponse();
    const request = {
      query: {
        error: "access_denied",
        error_description: "raw provider detail",
      },
    } as unknown as CallbackRequest;

    await oauthCallbackHandler(request, response);

    expect(redirect).toHaveBeenCalledWith(302, "/#/auth/finish?error=access_denied");
    expect(JSON.stringify(redirect.mock.calls)).not.toContain("raw provider detail");
  });

  it("collapses other provider errors to provider_error", async () => {
    const { response, redirect } = makeResponse();
    const request = {
      query: { error: "temporarily_unavailable" },
    } as unknown as CallbackRequest;

    await oauthCallbackHandler(request, response);

    expect(redirect).toHaveBeenCalledWith(302, "/#/auth/finish?error=provider_error");
  });

  it("routes malformed callbacks through the generic failure category", async () => {
    const { response, redirect } = makeResponse();
    const request = { query: {} } as unknown as CallbackRequest;

    await oauthCallbackHandler(request, response);

    expect(redirect).toHaveBeenCalledWith(302, "/#/auth/finish?error=callback_failed");
  });
});

describe("OAuth callback grant persistence", () => {
  const callbackRequest = {
    query: { state: "encrypted-state", iss: edge.ISSUER, code: "auth-code" },
  } as unknown as CallbackRequest;

  function tokenResponse(body: Record<string, unknown>): PublicHttpsResponse {
    return { status: 200, headers: {}, body: Buffer.from(JSON.stringify(body)) };
  }

  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    edge.dpopPrivateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    edge.dpopPublicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  });

  beforeEach(() => {
    process.env.APP_ORIGIN = "https://app.greenearth.social";
    process.env.BLUESKY_OAUTH_CLIENT_KID = "test-kid";
    edge.request.mockReset().mockResolvedValue(
      tokenResponse({
        sub: edge.DID,
        access_token: "access-secret",
        refresh_token: "refresh-secret",
        scope: "atproto transition:generic",
        token_type: "DPoP",
      }),
    );
    edge.persist.mockReset().mockResolvedValue(true);
    edge.createCustomToken.mockReset().mockResolvedValue("firebase-custom-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 404 })),
    );
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.APP_ORIGIN;
    delete process.env.BLUESKY_OAUTH_CLIENT_KID;
  });

  it("persists the grant before minting the custom token and redirects with the token", async () => {
    const { response, redirect } = makeResponse();

    await oauthCallbackHandler(callbackRequest, response);

    expect(edge.persist).toHaveBeenCalledTimes(1);
    expect(edge.persist).toHaveBeenCalledWith({
      did: edge.DID,
      issuer: edge.ISSUER,
      scope: "atproto transition:generic",
      refreshToken: "refresh-secret",
      dpopPrivateJwk: edge.dpopPrivateJwk,
    });
    const persistOrder = edge.persist.mock.invocationCallOrder[0] ?? Infinity;
    const mintOrder = edge.createCustomToken.mock.invocationCallOrder[0] ?? -Infinity;
    expect(persistOrder).toBeLessThan(mintOrder);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect.mock.calls[0]?.[1]).toContain("token=firebase-custom-token");
  });

  it("fails the login closed and mints no token when the grant cannot be stored", async () => {
    edge.persist.mockResolvedValue(false);
    const { response, redirect } = makeResponse();

    await oauthCallbackHandler(callbackRequest, response);

    expect(redirect).toHaveBeenCalledWith(302, "/#/auth/finish?error=callback_failed");
    expect(edge.createCustomToken).not.toHaveBeenCalled();
  });

  it("does not persist a grant for an account that fails identity verification", async () => {
    edge.request.mockResolvedValue(
      tokenResponse({ sub: "did:plc:someone-else", access_token: "a", refresh_token: "r" }),
    );
    const { response, redirect } = makeResponse();

    await oauthCallbackHandler(callbackRequest, response);

    expect(redirect).toHaveBeenCalledWith(302, "/#/auth/finish?error=callback_failed");
    expect(edge.persist).not.toHaveBeenCalled();
    expect(edge.createCustomToken).not.toHaveBeenCalled();
  });

  it("stores nothing when the provider issues no refresh token", async () => {
    edge.request.mockResolvedValue(tokenResponse({ sub: edge.DID, access_token: "a" }));
    const { response, redirect } = makeResponse();

    await oauthCallbackHandler(callbackRequest, response);

    expect(edge.persist).not.toHaveBeenCalled();
    expect(redirect.mock.calls[0]?.[1]).toContain("token=firebase-custom-token");
  });

  it("does not log tokens or key material", async () => {
    await oauthCallbackHandler(callbackRequest, makeResponse().response);
    edge.persist.mockResolvedValue(false);
    await oauthCallbackHandler(callbackRequest, makeResponse().response);

    const logged = JSON.stringify([logSpy.mock.calls, errorSpy.mock.calls]);
    expect(errorSpy).toHaveBeenCalled();
    const secrets = [
      "access-secret",
      "refresh-secret",
      "client-assertion",
      "dpop-proof",
      String(edge.dpopPrivateJwk.d),
    ];
    for (const secret of secrets) {
      expect(logged).not.toContain(secret);
    }
  });
});
