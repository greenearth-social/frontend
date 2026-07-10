#!/usr/bin/env node
/**
 * Generate an ES256 key pair for Bluesky OAuth and save to files.
 *
 * Run:
 *   node scripts/generate-oauth-keys.cjs
 *
 * This creates:
 *   functions/keys/private-key.json   — ES256 private key JWK
 *   functions/keys/public-jwks.json   — Public JWKS
 *
 * Also update functions/.env with:
 *   BLUESKY_OAUTH_CLIENT_KID=key-1
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KID = process.argv[2] || "key-1";
const KEYS_DIR = path.join(__dirname, "..", "functions", "keys");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "P-256",
  publicKeyEncoding: { type: "spki", format: "jwk" },
  privateKeyEncoding: { type: "pkcs8", format: "jwk" },
});

const publicJwks = {
  keys: [
    {
      ...publicKey,
      kid: KID,
      use: "sig",
      alg: "ES256",
    },
  ],
};

fs.mkdirSync(KEYS_DIR, { recursive: true });
fs.writeFileSync(
  path.join(KEYS_DIR, "private-key.json"),
  JSON.stringify(privateKey) + "\n",
);
fs.writeFileSync(
  path.join(KEYS_DIR, "public-jwks.json"),
  JSON.stringify(publicJwks) + "\n",
);

console.log("Keys written to functions/keys/");
console.log("  private-key.json — ES256 private key JWK");
console.log("  public-jwks.json — Public JWKS");
console.log("");
console.log("Add this to functions/.env:");
console.log("  BLUESKY_OAUTH_CLIENT_KID=" + KID);
