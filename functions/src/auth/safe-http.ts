import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import type { RequestOptions } from "node:https";
import type { TLSSocket } from "node:tls";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;

export interface PublicHttpsRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string | URLSearchParams;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface PublicHttpsResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

export interface PublicAddress {
  address: string;
  family: 4 | 6;
}

function mappedIpv4Address(address: string): string | null {
  const normalized = address.toLowerCase();
  if (!normalized.startsWith("::ffff:")) return null;

  const suffix = normalized.slice("::ffff:".length);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(suffix)) return suffix;

  const groups = suffix.split(":");
  if (groups.length !== 2) return null;
  const high = Number.parseInt(groups[0] ?? "", 16);
  const low = Number.parseInt(groups[1] ?? "", 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null;
  }
  return [
    String(high >> 8),
    String(high & 0xff),
    String(low >> 8),
    String(low & 0xff),
  ].join(".");
}

export function isPrivateOrReservedIp(address: string): boolean {
  const mapped = mappedIpv4Address(address);
  if (mapped) return isPrivateOrReservedIp(mapped);

  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a = 0, b = 0, c = 0] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("::") ||
      normalized.startsWith("64:ff9b:") ||
      normalized.startsWith("100:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:") ||
      normalized.startsWith("2002:")
    );
  }

  return true;
}

export function parsePublicHttpsUrl(value: string, originOnly = false): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Discovered an invalid server URL");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local") ||
    isIP(url.hostname) !== 0 ||
    (originOnly && (url.pathname !== "/" || url.search || url.hash))
  ) {
    throw new Error("Discovered server URL is not a public HTTPS origin");
  }
  return url;
}

export async function resolvePublicAddresses(hostname: string): Promise<PublicAddress[]> {
  let resolvedAddresses: Array<{ address: string; family: number }>;
  try {
    resolvedAddresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve the account server");
  }
  const addresses: PublicAddress[] = resolvedAddresses
    .filter((item) => item.family === 4 || item.family === 6)
    .map((item) => ({ address: item.address, family: item.family as 4 | 6 }));
  if (addresses.length === 0) {
    throw new Error("Could not resolve the account server");
  }
  if (addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
    throw new Error("Account server resolved to a private or reserved address");
  }
  // Cloud Functions has reliable IPv4 egress. Prefer IPv4 while retaining
  // IPv6-only support and every validated address as a fallback.
  return addresses.sort((left, right) => left.family - right.family);
}

export function pinnedRequestOptions(
  url: URL,
  address: PublicAddress,
  options: PublicHttpsRequestOptions = {},
): RequestOptions {
  return {
    protocol: "https:",
    hostname: address.address,
    family: address.family,
    port: url.port ? Number(url.port) : 443,
    method: options.method ?? "GET",
    path: `${url.pathname}${url.search}`,
    servername: url.hostname,
    rejectUnauthorized: true,
    agent: false,
    headers: {
      Accept: "application/json",
      ...options.headers,
      Host: url.host,
    },
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Account server request timed out"));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

class PinnedRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function requestPinnedAddress(
  url: URL,
  address: PublicAddress,
  options: PublicHttpsRequestOptions,
  timeoutMs: number,
  maxResponseBytes: number,
): Promise<PublicHttpsResponse> {
  const requestOptions = pinnedRequestOptions(url, address, options);
  const body = options.body?.toString();

  return new Promise<PublicHttpsResponse>((resolve, reject) => {
    let settled = false;
    let secureConnectionEstablished = false;
    const finishReject = (error: Error, retryable = false): void => {
      if (settled) return;
      settled = true;
      reject(new PinnedRequestError(error.message, retryable));
    };

    const request = httpsRequest(requestOptions, (response) => {
      secureConnectionEstablished = true;
      const declaredLength = Number(response.headers["content-length"] ?? "0");
      if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
        response.destroy();
        finishReject(new Error("Account server response was too large"));
        return;
      }

      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.byteLength;
        if (receivedBytes > maxResponseBytes) {
          response.destroy();
          finishReject(new Error("Account server response was too large"));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        });
      });
      response.on("error", (error: Error) => {
        finishReject(error);
      });
    });

    const timeout = setTimeout(() => {
      request.destroy(new Error("Account server request timed out"));
    }, timeoutMs);
    request.on("socket", (socket: TLSSocket) => {
      socket.once("secureConnect", () => {
        secureConnectionEstablished = true;
      });
    });
    request.on("close", () => {
      clearTimeout(timeout);
    });
    request.on("error", (error: Error) => {
      finishReject(error, !secureConnectionEstablished);
    });
    if (body !== undefined) request.write(body);
    request.end();
  });
}

export async function publicHttpsRequest(
  value: string,
  options: PublicHttpsRequestOptions = {},
): Promise<PublicHttpsResponse> {
  const url = parsePublicHttpsUrl(value);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const addresses = await withTimeout(resolvePublicAddresses(url.hostname), timeoutMs);
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

  let lastError: Error | undefined;
  for (const [index, address] of addresses.entries()) {
    const remainingTotalMs = timeoutMs - (Date.now() - startedAt);
    if (remainingTotalMs <= 0) {
      throw new Error("Account server request timed out");
    }
    const remainingAddresses = addresses.length - index;
    const attemptTimeoutMs = Math.max(1, Math.floor(remainingTotalMs / remainingAddresses));
    try {
      return await requestPinnedAddress(
        url,
        address,
        options,
        attemptTimeoutMs,
        maxResponseBytes,
      );
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!(error instanceof PinnedRequestError) || !error.retryable) throw lastError;
    }
  }
  throw lastError ?? new Error("Could not connect securely to the account server");
}

export function responseHeader(
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
