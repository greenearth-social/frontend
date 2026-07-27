import { describe, expect, it } from "vitest";
import { rewriteFunctionRequestPath } from "../utils/function-proxy";

describe("Functions emulator proxy", () => {
  it("preserves OAuth handle and return URL query parameters", () => {
    expect(
      rewriteFunctionRequestPath(
        "greenearth-471522",
        "authBluesky",
        "/auth/bluesky?return_url=%2Ffeed&handle=max.pds.techforwhat.xyz",
      ),
    ).toBe(
      "/greenearth-471522/us-central1/authBluesky?return_url=%2Ffeed&handle=max.pds.techforwhat.xyz",
    );
  });

  it("rewrites metadata routes without adding a query string", () => {
    expect(
      rewriteFunctionRequestPath(
        "greenearth-471522",
        "oauthClientMetadata",
        "/.well-known/oauth-client-metadata",
      ),
    ).toBe("/greenearth-471522/us-central1/oauthClientMetadata");
  });
});
