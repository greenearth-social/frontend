import { afterEach, describe, expect, it, vi } from "vitest";

const dns = vi.hoisted(() => ({
  lookup: vi.fn(),
  resolveTxt: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ ...dns, default: dns }));

import {
  assertOAuthIdentityMatch,
  assertSafePublicUrl,
  discoverIdentity,
  hardenedFetchJson,
  normalizeHandle,
  resolveHandle,
  resolveDid,
} from "../../functions/src/auth/auth-discovery";

const did = "did:plc:abc123";

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function authMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    pushed_authorization_request_endpoint: `${issuer}/oauth/par`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["private_key_jwt"],
    token_endpoint_auth_signing_alg_values_supported: ["ES256"],
    scopes_supported: ["atproto"],
    dpop_signing_alg_values_supported: ["ES256"],
    authorization_response_iss_parameter_supported: true,
    require_pushed_authorization_requests: true,
    client_id_metadata_document_supported: true,
  };
}

function mockDiscovery(pds: string, issuer: string): void {
  dns.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  dns.resolveTxt.mockResolvedValue([["did=", did]]);
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === `https://plc.directory/${did}`) {
      return Promise.resolve(
        json({
          id: did,
          alsoKnownAs: ["at://alice.example.com"],
          service: [{ id: "#atproto_pds", serviceEndpoint: pds }],
        }),
      );
    }
    if (url === `${pds}/.well-known/oauth-protected-resource`) {
      return Promise.resolve(json({ authorization_servers: [issuer] }));
    }
    if (url === `${issuer}/.well-known/oauth-authorization-server`) {
      return Promise.resolve(json(authMetadata(issuer)));
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe("AT Protocol OAuth discovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dns.lookup.mockReset();
    dns.resolveTxt.mockReset();
  });

  it("normalizes a user-entered handle", () => {
    expect(normalizeHandle("  @Alice.Example.COM ")).toBe("alice.example.com");
  });

  it("accepts standards-based JSON media types used by DID documents", async () => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: did }), {
        status: 200,
        headers: { "Content-Type": "application/did+ld+json; charset=utf-8" },
      }),
    );

    await expect(hardenedFetchJson("https://plc.directory/example")).resolves.toEqual({
      id: did,
    });
  });

  it("falls back to the public AppView when handle well-known resolution is unavailable", async () => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    dns.resolveTxt.mockRejectedValue(new Error("no TXT record"));
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith("https://alice.example.com/")) {
        return Promise.reject(new Error("TLS unavailable"));
      }
      if (url.startsWith("https://public.api.bsky.app/")) {
        return Promise.resolve(json({ did }));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    await expect(resolveHandle("alice.example.com")).resolves.toBe(did);
  });

  it("discovers a custom PDS that is its own authorization server", async () => {
    mockDiscovery("https://pds.example.com", "https://pds.example.com");

    await expect(discoverIdentity("@alice.example.com")).resolves.toMatchObject({
      handle: "alice.example.com",
      did,
      pds: "https://pds.example.com",
      issuer: "https://pds.example.com",
    });
  });

  it("uses a separate authorization-server entryway declared by the PDS", async () => {
    mockDiscovery("https://pds.example.com", "https://login.example.net");

    await expect(discoverIdentity("alice.example.com")).resolves.toMatchObject({
      pds: "https://pds.example.com",
      issuer: "https://login.example.net",
    });
  });

  it("discovers a Bluesky-hosted account through its declared entryway", async () => {
    mockDiscovery("https://bsky.network", "https://bsky.social");

    await expect(discoverIdentity("alice.example.com")).resolves.toMatchObject({
      pds: "https://bsky.network",
      issuer: "https://bsky.social",
    });
  });

  it("resolves did:web documents from their well-known location", async () => {
    dns.lookup.mockResolvedValue([{ address: "8.8.4.4", family: 4 }]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ id: "did:web:identity.example.com" }));

    await resolveDid("did:web:identity.example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://identity.example.com/.well-known/did.json"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects a DID document that does not claim the requested handle", async () => {
    mockDiscovery("https://pds.example.com", "https://pds.example.com");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      json({
        id: did,
        alsoKnownAs: ["at://mallory.example.com"],
        service: [{ id: "#atproto_pds", serviceEndpoint: "https://pds.example.com" }],
      }),
    );

    await expect(discoverIdentity("alice.example.com")).rejects.toThrow(
      "does not claim this handle",
    );
  });

  it("rejects private and local server targets", async () => {
    dns.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(assertSafePublicUrl("https://internal.example.com/oauth/par")).rejects.toThrow(
      "private or reserved",
    );
    await expect(assertSafePublicUrl("http://localhost/oauth/par")).rejects.toThrow(
      "public HTTPS",
    );
  });

  it("binds callback issuer and token subject to the discovered identity", () => {
    expect(() => {
      assertOAuthIdentityMatch("https://pds.example.com", "https://evil.example.com", did, did);
    }).toThrow("Issuer mismatch");
    expect(() => {
      assertOAuthIdentityMatch(
        "https://pds.example.com",
        "https://pds.example.com",
        did,
        "did:plc:other",
      );
    }).toThrow("does not match");
  });
});
