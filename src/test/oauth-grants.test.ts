import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RevokeInput, RevokeResult } from "../../functions/src/auth/oauth-revocation";

const mocks = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  databases: [] as string[],
  collections: [] as string[],
  failSet: false,
  revoke: vi.fn<(input: RevokeInput) => Promise<RevokeResult>>(),
}));

vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => ({
  getFirestore: (databaseId: string) => {
    mocks.databases.push(databaseId);
    return {
      collection: (name: string) => {
        mocks.collections.push(name);
        return {
          doc: (id: string) => ({
            get: () =>
              Promise.resolve({ exists: mocks.store.has(id), data: () => mocks.store.get(id) }),
            set: (value: Record<string, unknown>) => {
              if (mocks.failSet) return Promise.reject(new Error("firestore down"));
              mocks.store.set(id, value);
              return Promise.resolve();
            },
          }),
        };
      },
    };
  },
}));

vi.mock("../../functions/src/auth/oauth-revocation", () => ({
  revokeRefreshToken: mocks.revoke,
}));

import {
  OAUTH_GRANTS_COLLECTION,
  decryptGrantSecrets,
  encryptGrantSecrets,
  grantDatabaseId,
  loadGrant,
  persistLoginGrant,
  saveTombstone,
} from "../../functions/src/auth/oauth-grants";

const DID = "did:plc:abc";
const KEY = "11".repeat(32);
const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x: "x", y: "y", d: "private-d" };
const input = {
  did: DID,
  issuer: "https://pds.example",
  scope: "atproto transition:generic",
  refreshToken: "r1-secret",
  dpopPrivateJwk: jwk,
};

function revokeCall(index: number): RevokeInput {
  const call = mocks.revoke.mock.calls[index];
  if (!call) throw new Error(`revokeRefreshToken call ${String(index)} missing`);
  return call[0];
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.store.clear();
  mocks.databases.length = 0;
  mocks.collections.length = 0;
  mocks.failSet = false;
  mocks.revoke.mockReset().mockResolvedValue("revoked");
  process.env.OAUTH_SESSION_ENCRYPTION_KEY = KEY;
  delete process.env.OAUTH_SESSION_ENCRYPTION_KEY_STAGE;
  delete process.env.GE_FIRESTORE_DATABASE;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OAUTH_SESSION_ENCRYPTION_KEY;
  delete process.env.OAUTH_SESSION_ENCRYPTION_KEY_STAGE;
  delete process.env.GE_FIRESTORE_DATABASE;
});

describe("grant encryption", () => {
  it("round-trips", async () => {
    const blob = await encryptGrantSecrets({ refresh_token: "r", dpop_private_jwk: jwk }, DID);
    expect(blob).not.toContain("private-d");
    expect(await decryptGrantSecrets(blob, DID)).toEqual({
      refresh_token: "r",
      dpop_private_jwk: jwk,
    });
  });

  it("uses a fresh IV for every encryption", async () => {
    const secrets = { refresh_token: "r", dpop_private_jwk: jwk };
    const a = await encryptGrantSecrets(secrets, DID);
    const b = await encryptGrantSecrets(secrets, DID);
    expect(a).not.toBe(b);
  });

  it("binds the ciphertext to the DID", async () => {
    const blob = await encryptGrantSecrets({ refresh_token: "r", dpop_private_jwk: jwk }, DID);
    await expect(decryptGrantSecrets(blob, "did:plc:other")).rejects.toThrow();
  });

  it("rejects a different key and a tampered blob", async () => {
    const blob = await encryptGrantSecrets({ refresh_token: "r", dpop_private_jwk: jwk }, DID);
    process.env.OAUTH_SESSION_ENCRYPTION_KEY = "22".repeat(32);
    await expect(decryptGrantSecrets(blob, DID)).rejects.toThrow();
    process.env.OAUTH_SESSION_ENCRYPTION_KEY = KEY;
    const tampered = blob.slice(0, -2) + (blob.endsWith("AA") ? "BB" : "AA");
    await expect(decryptGrantSecrets(tampered, DID)).rejects.toThrow();
  });

  it("reads the stage key when the prod key is not bound", async () => {
    delete process.env.OAUTH_SESSION_ENCRYPTION_KEY;
    process.env.OAUTH_SESSION_ENCRYPTION_KEY_STAGE = KEY;
    const blob = await encryptGrantSecrets({ refresh_token: "r", dpop_private_jwk: jwk }, DID);
    expect((await decryptGrantSecrets(blob, DID)).refresh_token).toBe("r");
  });

  it("fails without a configured key", async () => {
    delete process.env.OAUTH_SESSION_ENCRYPTION_KEY;
    await expect(
      encryptGrantSecrets({ refresh_token: "r", dpop_private_jwk: jwk }, DID),
    ).rejects.toThrow(/not configured/);
  });

  it("rejects a key that is not 32 bytes of hex", async () => {
    process.env.OAUTH_SESSION_ENCRYPTION_KEY = "not-hex";
    await expect(
      encryptGrantSecrets({ refresh_token: "r", dpop_private_jwk: jwk }, DID),
    ).rejects.toThrow(/32 bytes/);
  });
});

describe("grantDatabaseId", () => {
  it("picks the database from which secret is bound, overridable for devenv", () => {
    expect(grantDatabaseId()).toBe("greenearth-prod");
    delete process.env.OAUTH_SESSION_ENCRYPTION_KEY;
    process.env.OAUTH_SESSION_ENCRYPTION_KEY_STAGE = KEY;
    expect(grantDatabaseId()).toBe("greenearth-stage");
    process.env.GE_FIRESTORE_DATABASE = "(default)";
    expect(grantDatabaseId()).toBe("(default)");
  });
});

describe("grant documents", () => {
  it("rejects malformed DIDs before touching Firestore", async () => {
    for (const bad of [
      "",
      "did:plc:",
      "did:plc:a/b",
      "did:plc:a b",
      `did:plc:${"a".repeat(2048)}`,
    ]) {
      await expect(loadGrant(bad)).rejects.toThrow(/Malformed DID/);
    }
    expect(mocks.databases).toEqual([]);
  });

  it("writes a token-free tombstone", async () => {
    await persistLoginGrant(input);
    await saveTombstone(DID);
    const doc = await loadGrant(DID);
    expect(doc).toMatchObject({ did: DID, status: "revoked" });
    expect(doc?.revoked_at).toBeInstanceOf(Date);
    expect(doc?.ciphertext).toBeUndefined();
  });
});

describe("persistLoginGrant", () => {
  it("stores an active grant with no plaintext token in oauth_grants/{did}", async () => {
    expect(await persistLoginGrant(input)).toBe(true);

    expect(mocks.databases).toContain("greenearth-prod");
    expect(mocks.collections).toContain(OAUTH_GRANTS_COLLECTION);
    expect(OAUTH_GRANTS_COLLECTION).toBe("oauth_grants");
    const doc = await loadGrant(DID);
    expect(doc).toMatchObject({
      did: DID,
      status: "active",
      issuer: "https://pds.example",
      scope: "atproto transition:generic",
    });
    expect(doc?.created_at).toBeInstanceOf(Date);
    expect(doc?.updated_at).toBeInstanceOf(Date);
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain("r1-secret");
    expect(serialized).not.toContain("private-d");
    expect(doc?.ciphertext).toBeTruthy();
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("revokes the previous grant on re-login before overwriting", async () => {
    await persistLoginGrant(input);
    await persistLoginGrant({ ...input, refreshToken: "r2-secret" });

    expect(mocks.revoke).toHaveBeenCalledTimes(1);
    expect(revokeCall(0)).toEqual({
      issuer: "https://pds.example",
      refreshToken: "r1-secret",
      dpopPrivateJwk: jwk,
    });
    const doc = await loadGrant(DID);
    const stored = await decryptGrantSecrets(doc?.ciphertext ?? "", DID);
    expect(stored.refresh_token).toBe("r2-secret");
  });

  it("does not try to revoke a tombstoned grant", async () => {
    await saveTombstone(DID);
    expect(await persistLoginGrant(input)).toBe(true);
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect((await loadGrant(DID))?.status).toBe("active");
  });

  it("still saves the new grant if revoking the old one fails", async () => {
    await persistLoginGrant(input);
    mocks.revoke.mockResolvedValue("failed");
    expect(await persistLoginGrant({ ...input, refreshToken: "r2-secret" })).toBe(true);
  });

  it("still saves the new grant if the old one cannot be decrypted", async () => {
    await persistLoginGrant(input);
    const old = mocks.store.get(DID) ?? {};
    mocks.store.set(DID, { ...old, ciphertext: "garbage" });

    expect(await persistLoginGrant({ ...input, refreshToken: "r2-secret" })).toBe(true);
    expect(mocks.revoke).not.toHaveBeenCalled();
    const stored = await decryptGrantSecrets((await loadGrant(DID))?.ciphertext ?? "", DID);
    expect(stored.refresh_token).toBe("r2-secret");
  });

  it("fails closed and revokes the just-issued grant when the save fails", async () => {
    mocks.failSet = true;

    expect(await persistLoginGrant(input)).toBe(false);

    expect(mocks.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "r1-secret", issuer: "https://pds.example" }),
    );
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("r1-secret");
    expect(logged).not.toContain("private-d");
  });

  it("fails closed when no encryption key is configured", async () => {
    delete process.env.OAUTH_SESSION_ENCRYPTION_KEY;

    expect(await persistLoginGrant(input)).toBe(false);

    expect(mocks.store.size).toBe(0);
    expect(mocks.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "r1-secret" }),
    );
  });

  it("fails closed for a malformed DID", async () => {
    expect(await persistLoginGrant({ ...input, did: "did:plc:a/b" })).toBe(false);
    expect(mocks.store.size).toBe(0);
  });

  it("still fails closed if the cleanup revoke rejects", async () => {
    mocks.failSet = true;
    mocks.revoke.mockRejectedValue(new Error("unexpected"));
    expect(await persistLoginGrant(input)).toBe(false);
  });
});
