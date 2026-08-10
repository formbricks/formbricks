import { getIp } from "@better-auth/core/utils/ip";
import * as nextHeaders from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  BETTER_AUTH_IP_ADDRESS_CONFIG,
  FORMBRICKS_CLIENT_IP_HEADER,
  UNTRUSTED_CLIENT_IP,
  getClientIpFromHeaders,
  resolveClientIp,
} from "./client-ip";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const buildHeaders = (headerMap: Record<string, string> = {}): Headers => new Headers(headerMap);

const mockHeaders = (headerMap: Record<string, string>) => {
  vi.mocked(nextHeaders.headers).mockResolvedValue(buildHeaders(headerMap) as never);
};

describe("resolveClientIp", () => {
  test("selects the trusted hop from the right and ignores any client-prepended entries", () => {
    const headers = buildHeaders({
      "x-forwarded-for": "9.9.9.9, 8.8.8.8, 203.0.113.7, 10.0.0.1",
    });

    expect(resolveClientIp(headers, 2)).toBe("203.0.113.7");
  });

  test.each(["203.0.113.7:80", "203.0.113.7:443", "203.0.113.7:65535"])(
    "removes a valid IPv4 port from %s",
    (forwardedIp) => {
      expect(resolveClientIp(buildHeaders({ "x-forwarded-for": forwardedIp }), 1)).toBe("203.0.113.7");
    }
  );

  test("keeps distinct IPv4 clients in distinct identities", () => {
    const firstClient = resolveClientIp(buildHeaders({ "x-forwarded-for": "203.0.113.7" }), 1);
    const secondClient = resolveClientIp(buildHeaders({ "x-forwarded-for": "203.0.113.8" }), 1);

    expect(firstClient).not.toBe(secondClient);
  });

  test.each(["[2001:DB8:abcd:12::99]", "[2001:DB8:abcd:12::99]:443"])(
    "accepts bracketed IPv6 with an optional valid port in %s",
    (forwardedIp) => {
      expect(resolveClientIp(buildHeaders({ "x-forwarded-for": forwardedIp }), 1)).toBe(
        "2001:0db8:abcd:0012:0000:0000:0000:0000"
      );
    }
  );

  test("converts IPv4-mapped IPv6 to IPv4", () => {
    expect(resolveClientIp(buildHeaders({ "x-forwarded-for": "::ffff:192.0.2.128" }), 1)).toBe("192.0.2.128");
  });

  test.each(["2001:DB8:abcd:12::1", "2001:0db8:abcd:0012:ffff:eeee:dddd:cccc"])(
    "canonicalizes IPv6 variants and masks host bits for %s",
    (forwardedIp) => {
      expect(resolveClientIp(buildHeaders({ "x-forwarded-for": forwardedIp }), 1)).toBe(
        "2001:0db8:abcd:0012:0000:0000:0000:0000"
      );
    }
  );

  test("treats a valid raw IPv6 value as an address, not an unbracketed socket", () => {
    expect(resolveClientIp(buildHeaders({ "x-forwarded-for": "2001:db8::1:443" }), 1)).toBe(
      "2001:0db8:0000:0000:0000:0000:0000:0000"
    );
  });

  test.each([
    "",
    "not-an-ip",
    "203.0.113.7:0",
    "203.0.113.7:65536",
    "203.0.113.7:http",
    "[203.0.113.7]:443",
    "[2001:db8::1",
    "[2001:db8::1]:",
    "[2001:db8::1]:443:1",
    "2001:db8::1%eth0",
  ])("rejects malformed or ambiguous selected values: %s", (forwardedIp) => {
    expect(resolveClientIp(buildHeaders({ "x-forwarded-for": forwardedIp }), 1)).toBeNull();
  });

  test("returns null when the forwarding chain is absent", () => {
    expect(resolveClientIp(buildHeaders(), 1)).toBeNull();
  });

  test("returns null instead of clamping when the chain is shorter than configured", () => {
    expect(resolveClientIp(buildHeaders({ "x-forwarded-for": "203.0.113.7" }), 2)).toBeNull();
  });

  test("returns null when trusted-hop resolution is disabled", () => {
    expect(resolveClientIp(buildHeaders({ "x-forwarded-for": "203.0.113.7" }), 0)).toBeNull();
  });

  test("never falls back to untrusted forwarding headers", () => {
    expect(
      resolveClientIp(buildHeaders({ "cf-connecting-ip": "198.51.100.5", "x-real-ip": "203.0.113.9" }), 1)
    ).toBeNull();
  });
});

describe("getClientIpFromHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the canonical identity from the private Proxy header", async () => {
    mockHeaders({ [FORMBRICKS_CLIENT_IP_HEADER]: "2001:DB8:abcd:12::99" });

    await expect(getClientIpFromHeaders()).resolves.toBe("2001:0db8:abcd:0012:0000:0000:0000:0000");
  });

  test("ignores raw forwarding headers when the private Proxy header is absent", async () => {
    mockHeaders({
      "x-forwarded-for": "198.51.100.4",
      "x-real-ip": "198.51.100.5",
      "cf-connecting-ip": "198.51.100.6",
    });

    await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
  });

  test.each(["not-an-ip", "203.0.113.7:443", "203.0.113.7, 198.51.100.4"])(
    "rejects a non-canonical private header value: %s",
    async (clientIp) => {
      mockHeaders({ [FORMBRICKS_CLIENT_IP_HEADER]: clientIp });
      await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
    }
  );

  test("returns the stable untrusted identity when the private header is absent", async () => {
    mockHeaders({});
    await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
  });

  test("returns the stable untrusted identity when headers() fails", async () => {
    vi.mocked(nextHeaders.headers).mockRejectedValue(new Error("Failed to get headers"));
    await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
  });
});

describe("Better Auth IP configuration", () => {
  test("resolves only the single-value private Proxy header with the shared IPv6 prefix", () => {
    const requestHeaders = buildHeaders({
      [FORMBRICKS_CLIENT_IP_HEADER]: "2001:0db8:abcd:0012:0000:0000:0000:0000",
      "x-forwarded-for": "198.51.100.4, 203.0.113.7",
    });

    expect(BETTER_AUTH_IP_ADDRESS_CONFIG).toEqual({
      ipAddressHeaders: [FORMBRICKS_CLIENT_IP_HEADER],
      ipv6Subnet: 64,
    });
    expect(getIp(requestHeaders, { advanced: { ipAddress: BETTER_AUTH_IP_ADDRESS_CONFIG } } as never)).toBe(
      "2001:0db8:abcd:0012:0000:0000:0000:0000"
    );
  });
});

describe("client IP diagnostics", () => {
  const loadFresh = async () => {
    vi.resetModules();
    const { logger } = await import("@formbricks/logger");
    const { resolveClientIp: freshResolveClientIp } = await import("./client-ip");
    return { logger, freshResolveClientIp };
  };

  test("emits throttled, reason-specific warnings without forwarding values", async () => {
    const { logger, freshResolveClientIp } = await loadFresh();
    const invalidValue = "sensitive-invalid-forwarded-value";

    freshResolveClientIp(buildHeaders({ "x-forwarded-for": "203.0.113.7" }), 0);
    freshResolveClientIp(buildHeaders({ "x-forwarded-for": "203.0.113.7" }), 0);
    freshResolveClientIp(buildHeaders({ "x-forwarded-for": "203.0.113.7" }), 2);
    freshResolveClientIp(buildHeaders({ "x-forwarded-for": invalidValue }), 1);

    expect(logger.warn).toHaveBeenCalledTimes(3);
    const warningText = vi
      .mocked(logger.warn)
      .mock.calls.map(([message]) => message)
      .join(" ");
    expect(warningText).toContain("disabled");
    expect(warningText).toContain("fewer entries");
    expect(warningText).toContain("not a valid supported IP address");
    expect(warningText).not.toContain(invalidValue);
  });

  test("warns again after the ten-minute throttle window", async () => {
    const { logger, freshResolveClientIp } = await loadFresh();
    const forwardedHeaders = buildHeaders({ "x-forwarded-for": "203.0.113.7" });

    vi.useFakeTimers();
    try {
      freshResolveClientIp(forwardedHeaders, 0);
      vi.advanceTimersByTime(9 * 60 * 1000);
      freshResolveClientIp(forwardedHeaders, 0);
      vi.advanceTimersByTime(2 * 60 * 1000);
      freshResolveClientIp(forwardedHeaders, 0);

      expect(logger.warn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("keeps completely headerless requests quiet", async () => {
    const { logger, freshResolveClientIp } = await loadFresh();

    expect(freshResolveClientIp(buildHeaders(), 0)).toBeNull();
    expect(freshResolveClientIp(buildHeaders(), 1)).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
