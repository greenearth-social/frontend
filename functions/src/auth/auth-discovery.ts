import { resolveTxt } from "node:dns/promises";
import {
  parsePublicHttpsUrl,
  publicHttpsRequest,
  responseHeader,
} from "./safe-http.js";

const HANDLE_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DID_RE = /^did:[a-z0-9]+:[A-Za-z0-9._:%-]*[A-Za-z0-9._-]$/;
const MAX_RESPONSE_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export interface DidDocument {
  id?: string;
  alsoKnownAs?: string[];
  service?: Array<{
    id?: string;
    type?: string | string[];
    serviceEndpoint?: string;
  }>;
}

export interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  pushed_authorization_request_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  token_endpoint_auth_signing_alg_values_supported: string[];
  scopes_supported: string[];
  dpop_signing_alg_values_supported: string[];
  authorization_response_iss_parameter_supported: boolean;
  require_pushed_authorization_requests: boolean;
  require_request_uri_registration?: boolean;
  client_id_metadata_document_supported: boolean;
}

export interface DiscoveredIdentity {
  handle: string;
  did: string;
  pds: string;
  issuer: string;
  authServerMetadata: AuthServerMetadata;
}

export const BLUESKY_AUTH_SERVER = "https://bsky.social";

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function isValidHandle(value: string): boolean {
  return HANDLE_RE.test(value);
}

export async function hardenedFetchJson<T>(urlValue: string): Promise<T> {
  const url = parsePublicHttpsUrl(urlValue);
  let response;
  try {
    response = await publicHttpsRequest(url.href, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error(`Could not connect securely to ${url.hostname}`);
  }
  if (response.status !== 200) {
    throw new Error(`Account server returned HTTP ${String(response.status)}`);
  }
  const contentType = responseHeader(response.headers, "content-type")?.toLowerCase() ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim() ?? "";
  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    throw new Error("Account server returned a non-JSON response");
  }
  const text = response.body.toString("utf8");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Account server returned invalid JSON");
  }
}

async function hardenedFetchText(urlValue: string): Promise<string> {
  const url = parsePublicHttpsUrl(urlValue);
  let response;
  try {
    response = await publicHttpsRequest(url.href, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxResponseBytes: 1024,
      headers: { Accept: "text/plain" },
    });
  } catch {
    throw new Error(`Could not connect securely to ${url.hostname}`);
  }
  if (response.status !== 200) {
    throw new Error(`Account server returned HTTP ${String(response.status)}`);
  }
  return response.body.toString("utf8").trim();
}

export async function resolveHandle(handle: string): Promise<string> {
  try {
    const records = await resolveTxt(`_atproto.${handle}`);
    for (const record of records) {
      const value = record.join("");
      if (value.startsWith("did=") && DID_RE.test(value.slice(4))) {
        return value.slice(4);
      }
    }
  } catch {
    // HTTP well-known is the required fallback when DNS resolution is absent.
  }

  try {
    const did = await hardenedFetchText(`https://${handle}/.well-known/atproto-did`);
    if (DID_RE.test(did)) return did;
  } catch {
    // A public AppView is a final availability fallback. The DID document is
    // still resolved independently and must claim the requested handle.
  }

  const appViewResult = await hardenedFetchJson<{ did?: string }>(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
  );
  if (!appViewResult.did || !DID_RE.test(appViewResult.did)) {
    throw new Error("The handle did not resolve to a valid DID");
  }
  return appViewResult.did;
}

export async function resolveDid(did: string): Promise<DidDocument> {
  if (did.startsWith("did:plc:")) {
    return hardenedFetchJson<DidDocument>(`https://plc.directory/${did}`);
  }
  if (did.startsWith("did:web:")) {
    const methodSpecific = did.slice("did:web:".length);
    const parts = methodSpecific.split(":").map((part) => decodeURIComponent(part));
    const hostname = parts.shift();
    if (!hostname || !isValidHandle(hostname)) {
      throw new Error("Unsupported did:web identifier");
    }
    const path =
      parts.length === 0
        ? "/.well-known/did.json"
        : `/${parts.map(encodeURIComponent).join("/")}/did.json`;
    return hardenedFetchJson<DidDocument>(`https://${hostname}${path}`);
  }
  throw new Error("This account uses an unsupported DID method");
}

function getPdsEndpoint(document: DidDocument): string {
  const service = document.service?.find(
    (candidate) =>
      candidate.id === "#atproto_pds" ||
      candidate.id?.endsWith("#atproto_pds"),
  );
  if (!service?.serviceEndpoint) {
    throw new Error("The account DID document does not declare a PDS");
  }
  return parsePublicHttpsUrl(service.serviceEndpoint, true).origin;
}

function requireStringArray(
  metadata: Record<string, unknown>,
  key: string,
): string[] {
  const value = metadata[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Authorization server metadata is missing ${key}`);
  }
  return value;
}

export async function fetchAuthServerMetadata(
  issuerValue: string,
): Promise<AuthServerMetadata> {
  const issuer = parsePublicHttpsUrl(issuerValue, true).origin;
  const raw = await hardenedFetchJson<Record<string, unknown>>(
    `${issuer}/.well-known/oauth-authorization-server`,
  );

  if (raw["issuer"] !== issuer) {
    throw new Error("Authorization server issuer does not match its metadata URL");
  }
  const endpointKeys = [
    "authorization_endpoint",
    "token_endpoint",
    "pushed_authorization_request_endpoint",
  ] as const;
  for (const key of endpointKeys) {
    if (typeof raw[key] !== "string") {
      throw new Error(`Authorization server metadata is missing ${key}`);
    }
    parsePublicHttpsUrl(raw[key]);
  }

  const responseTypes = requireStringArray(raw, "response_types_supported");
  const grants = requireStringArray(raw, "grant_types_supported");
  const challenges = requireStringArray(raw, "code_challenge_methods_supported");
  const authMethods = requireStringArray(raw, "token_endpoint_auth_methods_supported");
  const authAlgorithms = requireStringArray(
    raw,
    "token_endpoint_auth_signing_alg_values_supported",
  );
  const scopes = requireStringArray(raw, "scopes_supported");
  const dpopAlgorithms = requireStringArray(raw, "dpop_signing_alg_values_supported");
  if (
    !responseTypes.includes("code") ||
    !grants.includes("authorization_code") ||
    !challenges.includes("S256") ||
    !authMethods.includes("private_key_jwt") ||
    !authAlgorithms.includes("ES256") ||
    !scopes.includes("atproto") ||
    !dpopAlgorithms.includes("ES256") ||
    raw["authorization_response_iss_parameter_supported"] !== true ||
    raw["require_pushed_authorization_requests"] !== true ||
    raw["client_id_metadata_document_supported"] !== true ||
    raw["require_request_uri_registration"] === false
  ) {
    throw new Error("Authorization server does not support the AT Protocol OAuth profile");
  }
  return raw as unknown as AuthServerMetadata;
}

export async function discoverIdentity(rawHandle: string): Promise<DiscoveredIdentity> {
  const handle = normalizeHandle(rawHandle);
  if (!isValidHandle(handle)) {
    throw new Error("Enter a valid account handle, such as alice.bsky.social");
  }
  const did = await resolveHandle(handle);
  const document = await resolveDid(did);
  if (document.id && document.id !== did) {
    throw new Error("Resolved DID document does not match the account");
  }
  const claimedHandles = (document.alsoKnownAs ?? [])
    .filter((value) => value.startsWith("at://"))
    .map((value) => normalizeHandle(value.slice(5)));
  if (!claimedHandles.includes(handle)) {
    throw new Error("The account DID document does not claim this handle");
  }
  const pds = getPdsEndpoint(document);
  const resourceMetadata = await hardenedFetchJson<Record<string, unknown>>(
    `${pds}/.well-known/oauth-protected-resource`,
  );
  const authorizationServers = resourceMetadata["authorization_servers"];
  if (
    !Array.isArray(authorizationServers) ||
    authorizationServers.length !== 1 ||
    typeof authorizationServers[0] !== "string"
  ) {
    throw new Error("PDS metadata does not declare one authorization server");
  }
  const issuer = parsePublicHttpsUrl(authorizationServers[0], true).origin;
  const authServerMetadata = await fetchAuthServerMetadata(issuer);
  return { handle, did, pds, issuer, authServerMetadata };
}

export async function discoverAuthorizationServerForDid(
  did: string,
): Promise<{ pds: string; issuer: string; authServerMetadata: AuthServerMetadata }> {
  if (!DID_RE.test(did)) {
    throw new Error("Authorization server returned an invalid account DID");
  }
  const document = await resolveDid(did);
  if (document.id && document.id !== did) {
    throw new Error("Resolved DID document does not match the authenticated account");
  }
  const pds = getPdsEndpoint(document);
  const resourceMetadata = await hardenedFetchJson<Record<string, unknown>>(
    `${pds}/.well-known/oauth-protected-resource`,
  );
  const authorizationServers = resourceMetadata["authorization_servers"];
  if (
    !Array.isArray(authorizationServers) ||
    authorizationServers.length !== 1 ||
    typeof authorizationServers[0] !== "string"
  ) {
    throw new Error("PDS metadata does not declare one authorization server");
  }
  const issuer = parsePublicHttpsUrl(authorizationServers[0], true).origin;
  const authServerMetadata = await fetchAuthServerMetadata(issuer);
  return { pds, issuer, authServerMetadata };
}

export function assertOAuthIdentityMatch(
  expectedIssuer: string,
  callbackIssuer: string,
  expectedDid: string,
  authenticatedDid: string,
): void {
  if (callbackIssuer !== expectedIssuer) {
    throw new Error("Issuer mismatch");
  }
  if (authenticatedDid !== expectedDid) {
    throw new Error("Authenticated account does not match the requested handle");
  }
}
