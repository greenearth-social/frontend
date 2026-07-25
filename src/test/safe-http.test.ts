import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const dns = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

const transport = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ ...dns, default: dns }));
vi.mock("node:https", () => ({
  request: transport.request,
  default: { request: transport.request },
}));

import {
  isPrivateOrReservedIp,
  parsePublicHttpsUrl,
  pinnedRequestOptions,
  publicHttpsRequest,
  resolvePublicAddresses,
} from "../../functions/src/auth/safe-http";

describe("SSRF-safe HTTPS transport", () => {
  afterEach(() => {
    dns.lookup.mockReset();
    transport.request.mockReset();
  });

  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
  ])("rejects private or reserved address %s", (address) => {
    expect(isPrivateOrReservedIp(address)).toBe(true);
  });

  it("rejects a hostname when any DNS answer is private", async () => {
    dns.lookup.mockResolvedValue([
      { address: "203.1.2.3", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(resolvePublicAddresses("rebind.example.com")).rejects.toThrow(
      "private or reserved",
    );
  });

  it("retains every public address and prioritizes IPv4", async () => {
    dns.lookup.mockResolvedValue([
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "203.1.2.4", family: 4 },
      { address: "203.1.2.3", family: 4 },
    ]);

    await expect(resolvePublicAddresses("pds.example.com")).resolves.toEqual([
      { address: "203.1.2.4", family: 4 },
      { address: "203.1.2.3", family: 4 },
      { address: "2001:4860:4860::8888", family: 6 },
    ]);
  });

  it("rejects local and non-HTTPS URLs before DNS resolution", () => {
    expect(() => parsePublicHttpsUrl("http://localhost/oauth/par")).toThrow(
      "public HTTPS",
    );
    expect(() => parsePublicHttpsUrl("https://127.0.0.1/oauth/par")).toThrow(
      "public HTTPS",
    );
  });

  it("pins the actual socket to the validated IP while preserving Host and TLS SNI", () => {
    const url = parsePublicHttpsUrl("https://pds.example.com/oauth/par?flow=1");
    const options = pinnedRequestOptions(
      url,
      { address: "203.1.2.3", family: 4 },
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    expect(options).toMatchObject({
      hostname: "203.1.2.3",
      family: 4,
      port: 443,
      path: "/oauth/par?flow=1",
      servername: "pds.example.com",
      rejectUnauthorized: true,
    });
    expect(options.headers).toMatchObject({ Host: "pds.example.com" });
  });

  it("aborts while streaming a response larger than the configured limit", async () => {
    dns.lookup.mockResolvedValue([{ address: "203.1.2.3", family: 4 }]);
    transport.request.mockImplementation((_options, callback: (response: EventEmitter) => void) => {
      const request = new EventEmitter() as EventEmitter & {
        write: (body: string) => void;
        end: () => void;
        destroy: (error: Error) => void;
      };
      request.write = () => {};
      request.destroy = (error) => {
        request.emit("error", error);
        request.emit("close");
      };
      request.end = () => {
        const response = new EventEmitter() as EventEmitter & {
          statusCode: number;
          headers: Record<string, string>;
          destroy: () => void;
        };
        response.statusCode = 200;
        response.headers = {};
        response.destroy = () => {
          request.emit("close");
        };
        callback(response);
        response.emit("data", Buffer.alloc(5));
      };
      return request;
    });

    await expect(
      publicHttpsRequest("https://pds.example.com/oauth/par", {
        maxResponseBytes: 4,
      }),
    ).rejects.toThrow("too large");
  });

  it("aborts a request when its total deadline expires", async () => {
    dns.lookup.mockResolvedValue([{ address: "203.1.2.3", family: 4 }]);
    transport.request.mockImplementation(() => {
      const request = new EventEmitter() as EventEmitter & {
        write: (body: string) => void;
        end: () => void;
        destroy: (error: Error) => void;
      };
      request.write = () => {};
      request.end = () => {};
      request.destroy = (error) => {
        request.emit("error", error);
        request.emit("close");
      };
      return request;
    });

    await expect(
      publicHttpsRequest("https://pds.example.com/oauth/par", {
        timeoutMs: 5,
      }),
    ).rejects.toThrow("timed out");
  });

  it("applies the total deadline to DNS resolution too", async () => {
    dns.lookup.mockReturnValue(new Promise(() => {}));

    await expect(
      publicHttpsRequest("https://pds.example.com/oauth/par", {
        timeoutMs: 5,
      }),
    ).rejects.toThrow("timed out");
    expect(transport.request).not.toHaveBeenCalled();
  });

  it("falls back to the next validated address after a pre-TLS connection failure", async () => {
    dns.lookup.mockResolvedValue([
      { address: "203.1.2.3", family: 4 },
      { address: "203.1.2.4", family: 4 },
    ]);
    transport.request.mockImplementation(
      (
        options: { hostname?: string },
        callback: (response: EventEmitter) => void,
      ) => {
        const request = new EventEmitter() as EventEmitter & {
          write: (body: string) => void;
          end: () => void;
          destroy: (error: Error) => void;
        };
        request.write = () => {};
        request.destroy = (error) => {
          request.emit("error", error);
          request.emit("close");
        };
        request.end = () => {
          const socket = new EventEmitter();
          request.emit("socket", socket);
          if (options.hostname === "203.1.2.3") {
            request.emit("error", new Error("connect ECONNREFUSED"));
            request.emit("close");
            return;
          }

          socket.emit("secureConnect");
          const response = new EventEmitter() as EventEmitter & {
            statusCode: number;
            headers: Record<string, string>;
            destroy: () => void;
          };
          response.statusCode = 200;
          response.headers = { "content-type": "application/json" };
          response.destroy = () => {};
          callback(response);
          response.emit("data", Buffer.from("{}"));
          response.emit("end");
          request.emit("close");
        };
        return request;
      },
    );

    await expect(
      publicHttpsRequest("https://pds.example.com/oauth/par", {
        method: "POST",
        body: new URLSearchParams({ client_id: "test" }),
      }),
    ).resolves.toMatchObject({ status: 200, body: Buffer.from("{}") });
    expect(transport.request).toHaveBeenCalledTimes(2);
  });

  it("does not retry a POST after TLS succeeds", async () => {
    dns.lookup.mockResolvedValue([
      { address: "203.1.2.3", family: 4 },
      { address: "203.1.2.4", family: 4 },
    ]);
    transport.request.mockImplementation(() => {
      const request = new EventEmitter() as EventEmitter & {
        write: (body: string) => void;
        end: () => void;
        destroy: (error: Error) => void;
      };
      request.write = () => {};
      request.destroy = (error) => {
        request.emit("error", error);
        request.emit("close");
      };
      request.end = () => {
        const socket = new EventEmitter();
        request.emit("socket", socket);
        socket.emit("secureConnect");
        request.emit("error", new Error("connection reset after TLS"));
        request.emit("close");
      };
      return request;
    });

    await expect(
      publicHttpsRequest("https://pds.example.com/oauth/par", {
        method: "POST",
        body: new URLSearchParams({ client_id: "test" }),
      }),
    ).rejects.toThrow("connection reset after TLS");
    expect(transport.request).toHaveBeenCalledTimes(1);
  });
});
