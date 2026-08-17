import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
