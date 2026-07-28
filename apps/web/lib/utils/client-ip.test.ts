import * as nextHeaders from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { UNTRUSTED_CLIENT_IP, getClientIpFromHeaders, resolveClientIp } from "./client-ip";

// Mock next/headers
declare module "next/headers" {
  export function headers(): any;
}

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// TRUSTED_PROXY_HOP_COUNT defaults to 0, so getClientIpFromHeaders trusts nothing unless configured.
vi.mock("@/lib/constants", () => ({ TRUSTED_PROXY_HOP_COUNT: 0 }));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));

const buildHeaders = (headerMap: Record<string, string | undefined>): Headers =>
  ({
    get: (key: string) => headerMap[key.toLowerCase()] ?? null,
  }) as Headers;

const mockHeaders = (headerMap: Record<string, string | undefined>) => {
  vi.mocked(nextHeaders.headers).mockReturnValue(buildHeaders(headerMap));
};

describe("resolveClientIp", () => {
  // Regression: X-Forwarded-For is appended to by each proxy, so its leftmost entry is client-supplied.
  // Reading it let a caller rotate the header to mint a fresh rate-limit bucket per request, bypassing
  // the login / forgot-password / signup / public-API limits, and to forge captured IPs.
  describe("with one trusted proxy", () => {
    test("takes the entry the trusted proxy appended, not the client-supplied one", () => {
      const headers = buildHeaders({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });
      expect(resolveClientIp(headers, 1)).toBe("203.0.113.7");
    });

    test("ignores a spoofed chain the client prepended", () => {
      const headers = buildHeaders({
        "x-forwarded-for": "9.9.9.9, 8.8.8.8, 7.7.7.7, 203.0.113.7",
      });
      expect(resolveClientIp(headers, 1)).toBe("203.0.113.7");
    });

    test("honors cf-connecting-ip ahead of the forwarded chain", () => {
      const headers = buildHeaders({
        "cf-connecting-ip": "198.51.100.5",
        "x-forwarded-for": "1.1.1.1, 203.0.113.7",
      });
      expect(resolveClientIp(headers, 1)).toBe("198.51.100.5");
    });

    test("trims whitespace around the selected entry", () => {
      const headers = buildHeaders({ "x-forwarded-for": "  1.1.1.1  ,   203.0.113.7  " });
      expect(resolveClientIp(headers, 1)).toBe("203.0.113.7");
    });

    test("falls back to x-real-ip when there is no forwarded chain", () => {
      const headers = buildHeaders({ "x-real-ip": "203.0.113.9" });
      expect(resolveClientIp(headers, 1)).toBe("203.0.113.9");
    });

    test("reports the client as untrusted when no header identifies it", () => {
      expect(resolveClientIp(buildHeaders({}), 1)).toBe(UNTRUSTED_CLIENT_IP);
    });
  });

  describe("with two trusted proxies", () => {
    test("takes the second entry from the right", () => {
      const headers = buildHeaders({ "x-forwarded-for": "1.1.1.1, 203.0.113.7, 10.0.0.1" });
      expect(resolveClientIp(headers, 2)).toBe("203.0.113.7");
    });

    test("clamps to the earliest entry when the chain is shorter than configured", () => {
      const headers = buildHeaders({ "x-forwarded-for": "203.0.113.7" });
      expect(resolveClientIp(headers, 2)).toBe("203.0.113.7");
    });
  });

  describe("with no trusted proxy", () => {
    test.each([
      ["x-forwarded-for", { "x-forwarded-for": "1.1.1.1, 203.0.113.7" }],
      ["cf-connecting-ip", { "cf-connecting-ip": "1.1.1.1" }],
      ["x-real-ip", { "x-real-ip": "1.1.1.1" }],
    ])("does not believe %s", (_label, headerMap) => {
      expect(resolveClientIp(buildHeaders(headerMap), 0)).toBe(UNTRUSTED_CLIENT_IP);
    });

    test("treats a negative hop count as zero", () => {
      const headers = buildHeaders({ "x-forwarded-for": "1.1.1.1" });
      expect(resolveClientIp(headers, -1)).toBe(UNTRUSTED_CLIENT_IP);
    });
  });
});

describe("getClientIpFromHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("trusts nothing at the default hop count of 0", async () => {
    mockHeaders({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" });
    await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
  });

  test("handles errors when headers() throws an exception", async () => {
    vi.mocked(nextHeaders.headers).mockImplementation(() => {
      throw new Error("Failed to get headers");
    });

    await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
  });
});
