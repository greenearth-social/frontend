import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PublicHttpsRequestOptions,
  PublicHttpsResponse,
} from "../../functions/src/auth/safe-http";

const mocks = vi.hoisted(() => ({
  request:
    vi.fn<(url: string, options: PublicHttpsRequestOptions) => Promise<PublicHttpsResponse>>(),
  metadata: vi.fn<(issuer: string) => Promise<Record<string, unknown>>>(),
}));

vi.mock("../../functions/src/auth/safe-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../functions/src/auth/safe-http")>();
  return { ...actual, publicHttpsRequest: mocks.request };
});

vi.mock("../../functions/src/auth/auth-discovery", () => ({
  fetchAuthServerMetadata: mocks.metadata,
}));

vi.mock("../../functions/src/auth/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../functions/src/auth/helpers")>();
  const { privateKey } = await actual.generateDpopKeyPair();
  return { ...actual, getClientPrivateKey: () => Promise.resolve(privateKey) };
});

import { revokeRefreshToken } from "../../functions/src/auth/oauth-revocation";
import { exportPrivateJwk, generateDpopKeyPair } from "../../functions/src/auth/helpers";

const ISSUER = "https://pds.example";

function res(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): PublicHttpsResponse {
  return { status, headers, body: Buffer.from(JSON.stringify(body)) };
}

async function input() {
  const pair = await generateDpopKeyPair();
  return {
    issuer: ISSUER,
    refreshToken: "refresh-secret",
    dpopPrivateJwk: await exportPrivateJwk(pair.privateKey),
  };
}

function decodeJwtPart(jwt: string, index: number): Record<string, unknown> {
  const part = jwt.split(".")[index] ?? "";
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

function requestCall(index: number): [string, PublicHttpsRequestOptions] {
  const call = mocks.request.mock.calls[index];
  if (!call) throw new Error(`publicHttpsRequest call ${String(index)} missing`);
  return call;
}

describe("revokeRefreshToken", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.request.mockReset();
    mocks.metadata.mockReset();
    process.env.APP_ORIGIN = "https://app.example";
    process.env.BLUESKY_OAUTH_CLIENT_KID = "kid-1";
    mocks.metadata.mockResolvedValue({ revocation_endpoint: `${ISSUER}/oauth/revoke` });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.APP_ORIGIN;
    delete process.env.BLUESKY_OAUTH_CLIENT_KID;
  });

  it("returns revoked on 200 and posts an RFC 7009 request with DPoP and client assertion", async () => {
    mocks.request.mockResolvedValue(res(200));

    expect(await revokeRefreshToken(await input())).toBe("revoked");

    const [url, opts] = requestCall(0);
    expect(url).toBe(`${ISSUER}/oauth/revoke`);
    expect(opts.method).toBe("POST");
    const body = opts.body as URLSearchParams;
    expect(body.get("client_id")).toBe("https://app.example/.well-known/oauth-client-metadata");
    expect(body.get("token")).toBe("refresh-secret");
    expect(body.get("token_type_hint")).toBe("refresh_token");
    expect(body.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    const assertion = body.get("client_assertion") ?? "";
    expect(decodeJwtPart(assertion, 0)).toMatchObject({ alg: "ES256", kid: "kid-1" });
    expect(decodeJwtPart(assertion, 1)).toMatchObject({ aud: ISSUER });
    const dpop = opts.headers?.["DPoP"] ?? "";
    const dpopHeader = decodeJwtPart(dpop, 0);
    expect(dpopHeader).toMatchObject({ typ: "dpop+jwt", alg: "ES256" });
    expect(dpopHeader["jwk"]).not.toHaveProperty("d");
    expect(decodeJwtPart(dpop, 1)).toMatchObject({ htm: "POST", htu: `${ISSUER}/oauth/revoke` });
  });

  it("retries once with the server-provided DPoP nonce", async () => {
    mocks.request
      .mockResolvedValueOnce(res(400, { error: "use_dpop_nonce" }, { "dpop-nonce": "n1" }))
      .mockResolvedValueOnce(res(200));

    expect(await revokeRefreshToken(await input())).toBe("revoked");

    expect(mocks.request).toHaveBeenCalledTimes(2);
    const [, retry] = requestCall(1);
    expect(decodeJwtPart(retry.headers?.["DPoP"] ?? "", 1)).toMatchObject({ nonce: "n1" });
  });

  it.each(["invalid_grant", "invalid_token"])("maps %s to already_revoked", async (error) => {
    mocks.request.mockResolvedValue(res(400, { error }));
    expect(await revokeRefreshToken(await input())).toBe("already_revoked");
  });

  it("fails on 5xx, network errors and a missing revocation_endpoint", async () => {
    mocks.request.mockResolvedValue(res(503));
    expect(await revokeRefreshToken(await input())).toBe("failed");

    mocks.request.mockRejectedValue(new Error("boom"));
    expect(await revokeRefreshToken(await input())).toBe("failed");

    mocks.metadata.mockResolvedValue({});
    expect(await revokeRefreshToken(await input())).toBe("failed");
  });

  it("fails without sending the token when metadata or the endpoint is unusable", async () => {
    mocks.metadata.mockRejectedValue(new Error("metadata down"));
    expect(await revokeRefreshToken(await input())).toBe("failed");

    mocks.metadata.mockResolvedValue({ revocation_endpoint: "http://pds.example/oauth/revoke" });
    expect(await revokeRefreshToken(await input())).toBe("failed");

    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("fails when the OAuth client is not configured", async () => {
    delete process.env.BLUESKY_OAUTH_CLIENT_KID;
    expect(await revokeRefreshToken(await input())).toBe("failed");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("never logs the refresh token, key material or server-supplied text", async () => {
    const revokeInput = await input();
    mocks.request.mockRejectedValueOnce(new Error("boom refresh-secret"));
    await revokeRefreshToken(revokeInput);
    mocks.request.mockResolvedValueOnce(res(400, { error: "refresh-secret" }));
    await revokeRefreshToken(revokeInput);

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(errorSpy).toHaveBeenCalled();
    expect(logged).not.toContain("refresh-secret");
    expect(logged).not.toContain(String(revokeInput.dpopPrivateJwk.d));
  });
});
