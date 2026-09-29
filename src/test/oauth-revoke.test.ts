import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RevokeInput, RevokeResult } from "../../functions/src/auth/oauth-revocation";

type Doc = Record<string, unknown>;
interface MockRef {
  id: string;
}

const mocks = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  failSet: false,
  transactions: 0,
  initializeApp: vi.fn(),
  revoke: vi.fn<(input: RevokeInput) => Promise<RevokeResult>>(),
}));

vi.mock("../../functions/node_modules/firebase-admin/lib/esm/app/index.js", () => ({
  getApps: () => [],
  initializeApp: mocks.initializeApp,
}));

vi.mock("../../functions/node_modules/firebase-admin/lib/esm/firestore/index.js", () => {
  const snapshot = (id: string) => ({
    exists: mocks.store.has(id),
    data: () => mocks.store.get(id),
  });
  const write = (id: string, value: Doc) => {
    if (mocks.failSet) return Promise.reject(new Error("firestore down"));
    mocks.store.set(id, value);
    return Promise.resolve();
  };
  return {
    getFirestore: () => ({
      collection: () => ({
        doc: (id: string): MockRef & Record<string, unknown> => ({
          id,
          get: () => Promise.resolve(snapshot(id)),
          set: (value: Doc) => write(id, value),
        }),
      }),
      runTransaction: async <T>(
        fn: (tx: {
          get: (ref: MockRef) => Promise<ReturnType<typeof snapshot>>;
          set: (ref: MockRef, value: Doc) => void;
        }) => Promise<T>,
      ): Promise<T> => {
        mocks.transactions += 1;
        const writes: [string, Doc][] = [];
        const result = await fn({
          get: (ref) => Promise.resolve(snapshot(ref.id)),
          set: (ref, value) => {
            writes.push([ref.id, value]);
          },
        });
        for (const [id, value] of writes) await write(id, value);
        return result;
      },
    }),
  };
});

vi.mock("../../functions/src/auth/oauth-revocation", () => ({
  revokeRefreshToken: mocks.revoke,
}));

import {
  decryptGrantSecrets,
  loadGrant,
  persistLoginGrant,
} from "../../functions/src/auth/oauth-grants";
import { oauthRevokeHandler, revokeGrant } from "../../functions/src/auth/oauth-revoke";

type RevokeRequest = Parameters<typeof oauthRevokeHandler>[0];
type RevokeResponse = Parameters<typeof oauthRevokeHandler>[1];

const DID = "did:plc:abc";
const KEY = "11".repeat(32);
const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x: "x", y: "y", d: "private-d" };
const login = (refreshToken: string) =>
  persistLoginGrant({
    did: DID,
    issuer: "https://pds.example",
    scope: "atproto transition:generic",
    refreshToken,
    dpopPrivateJwk: jwk,
  });

let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

function loggedText(): string {
  return JSON.stringify([logSpy.mock.calls, errorSpy.mock.calls]);
}

async function seed(refreshToken = "r1-secret"): Promise<void> {
  expect(await login(refreshToken)).toBe(true);
  mocks.revoke.mockReset();
}

beforeEach(() => {
  mocks.store.clear();
  mocks.failSet = false;
  mocks.transactions = 0;
  mocks.revoke.mockReset();
  process.env.OAUTH_SESSION_ENCRYPTION_KEY = KEY;
  delete process.env.OAUTH_SESSION_ENCRYPTION_KEY_STAGE;
  delete process.env.GE_FIRESTORE_DATABASE;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OAUTH_SESSION_ENCRYPTION_KEY;
});

describe("oauth-revoke module", () => {
  it("initializes the admin app itself instead of relying on import order", () => {
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
  });
});

describe("revokeGrant", () => {
  it("returns no_session when there is no grant and writes nothing", async () => {
    expect(await revokeGrant(DID)).toBe("no_session");
    expect(mocks.store.size).toBe(0);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("revokes an active grant and replaces it with a token-free tombstone", async () => {
    await seed();
    mocks.revoke.mockResolvedValue("revoked");

    expect(await revokeGrant(DID)).toBe("revoked");

    expect(mocks.revoke).toHaveBeenCalledWith({
      issuer: "https://pds.example",
      refreshToken: "r1-secret",
      dpopPrivateJwk: jwk,
    });
    const written = mocks.store.get(DID);
    expect(Object.keys(written ?? {}).sort()).toEqual(["did", "revoked_at", "status"]);
    expect(written).toMatchObject({ did: DID, status: "revoked" });
    expect(written?.["revoked_at"]).toBeInstanceOf(Date);
  });

  it("is idempotent: a tombstone yields already_revoked without contacting the server", async () => {
    await seed();
    mocks.revoke.mockResolvedValue("revoked");
    await revokeGrant(DID);
    mocks.revoke.mockClear();

    expect(await revokeGrant(DID)).toBe("already_revoked");
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("maps an explicit invalid_grant from the server to already_revoked and tombstones", async () => {
    await seed();
    mocks.revoke.mockResolvedValue("already_revoked");

    expect(await revokeGrant(DID)).toBe("already_revoked");
    expect((await loadGrant(DID))?.status).toBe("revoked");
  });

  it("returns failed and leaves the grant untouched when the auth server fails", async () => {
    await seed();
    const before = structuredClone(mocks.store.get(DID));
    mocks.revoke.mockResolvedValue("failed");

    expect(await revokeGrant(DID)).toBe("failed");
    expect(mocks.store.get(DID)).toEqual(before);
  });

  it("returns failed and leaves the doc untouched when the grant cannot be decrypted", async () => {
    await seed();
    const before = structuredClone(mocks.store.get(DID));
    process.env.OAUTH_SESSION_ENCRYPTION_KEY = "22".repeat(32);

    expect(await revokeGrant(DID)).toBe("failed");
    expect(mocks.store.get(DID)).toEqual(before);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("returns failed for an active grant with no ciphertext", async () => {
    mocks.store.set(DID, { did: DID, status: "active", issuer: "https://pds.example" });

    expect(await revokeGrant(DID)).toBe("failed");
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.store.get(DID)?.["status"]).toBe("active");
  });

  it("returns failed when the tombstone write fails, and a retry converges", async () => {
    await seed();
    const before = structuredClone(mocks.store.get(DID));
    mocks.revoke.mockResolvedValue("revoked");
    mocks.failSet = true;

    expect(await revokeGrant(DID)).toBe("failed");
    expect(mocks.store.get(DID)).toEqual(before);

    mocks.failSet = false;
    mocks.revoke.mockResolvedValue("already_revoked");
    expect(await revokeGrant(DID)).toBe("already_revoked");
    expect((await loadGrant(DID))?.status).toBe("revoked");
  });

  it("converges to a single tombstone under concurrent revokes", async () => {
    await seed();
    mocks.revoke.mockResolvedValueOnce("revoked").mockResolvedValue("already_revoked");

    const outcomes = await Promise.all([revokeGrant(DID), revokeGrant(DID)]);

    expect(outcomes.sort()).toEqual(["already_revoked", "revoked"]);
    const written = mocks.store.get(DID);
    expect(Object.keys(written ?? {}).sort()).toEqual(["did", "revoked_at", "status"]);
  });

  it("does not tombstone over a newer grant written by a concurrent login", async () => {
    await seed("r1-secret");
    mocks.revoke.mockImplementationOnce(async () => {
      expect(await login("r2-secret")).toBe(true);
      return "revoked";
    });

    expect(await revokeGrant(DID)).toBe("failed");

    const current = await loadGrant(DID);
    expect(current?.status).toBe("active");
    const secrets = await decryptGrantSecrets(current?.ciphertext ?? "", DID);
    expect(secrets.refresh_token).toBe("r2-secret");

    mocks.revoke.mockReset().mockResolvedValue("revoked");
    expect(await revokeGrant(DID)).toBe("revoked");
    expect(mocks.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "r2-secret" }),
    );
    expect((await loadGrant(DID))?.status).toBe("revoked");
  });

  it("does not resurrect a grant doc deleted while revoking", async () => {
    await seed();
    mocks.revoke.mockImplementationOnce(() => {
      mocks.store.delete(DID);
      return Promise.resolve("revoked");
    });

    expect(await revokeGrant(DID)).toBe("revoked");
    expect(mocks.store.has(DID)).toBe(false);
  });

  it("writes the tombstone in a transaction, never with the network call inside it", async () => {
    await seed();
    let transactionsDuringRevoke = -1;
    mocks.revoke.mockImplementationOnce(() => {
      transactionsDuringRevoke = mocks.transactions;
      return Promise.resolve("revoked");
    });

    await revokeGrant(DID);

    expect(transactionsDuringRevoke).toBe(0);
    expect(mocks.transactions).toBe(1);
  });

  it("never logs secrets", async () => {
    await seed();
    mocks.revoke.mockResolvedValue("failed");
    await revokeGrant(DID);
    mocks.failSet = true;
    mocks.revoke.mockResolvedValue("revoked");
    await revokeGrant(DID);
    mocks.failSet = false;
    mocks.revoke.mockImplementationOnce(async () => {
      await login("r2-secret");
      return "revoked";
    });
    await revokeGrant(DID);
    process.env.OAUTH_SESSION_ENCRYPTION_KEY = "22".repeat(32);
    await revokeGrant(DID);

    expect(errorSpy).toHaveBeenCalled();
    const logged = loggedText();
    for (const secret of ["r1-secret", "r2-secret", "private-d", KEY, "22".repeat(32)]) {
      expect(logged).not.toContain(secret);
    }
  });
});

function call(method: string, body: unknown) {
  const json = vi.fn();
  const status = vi.fn();
  const response = { status, json } as unknown as RevokeResponse;
  status.mockReturnValue(response);
  const request = { method, body } as unknown as RevokeRequest;
  return { status, json, run: () => oauthRevokeHandler(request, response) };
}

describe("oauthRevokeHandler", () => {
  it("rejects non-POST with 405", async () => {
    const { status, run } = call("GET", {});
    await run();
    expect(status).toHaveBeenCalledWith(405);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { did: "" },
    { did: "did:plc:" },
    { did: "did:plc:a/b" },
    { did: "did:plc:a b" },
    { did: ` ${DID}` },
    { did: `did:plc:${"a".repeat(2048)}` },
    { did: 5 },
    { did: [DID] },
    null,
    DID,
  ])("rejects a malformed did with 400 (%j)", async (body) => {
    const { status, json, run } = call("POST", body);
    await run();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "invalid_did" });
    expect(mocks.store.size).toBe(0);
    expect(mocks.transactions).toBe(0);
  });

  it("returns the outcome and nothing else", async () => {
    const { status, json, run } = call("POST", { did: DID });
    await run();
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ outcome: "no_session" });
  });

  it("returns 200 with failed so the caller can map it", async () => {
    await seed();
    mocks.revoke.mockResolvedValue("failed");
    const { status, json, run } = call("POST", { did: DID });
    await run();
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ outcome: "failed" });
  });
});
