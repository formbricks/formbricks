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

// Mirrors the shipped default of 1: one trusted reverse proxy in front of the app.
vi.mock("@/lib/constants", () => ({ TRUSTED_PROXY_HOP_COUNT: 1 }));

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

    // A hop count says "one proxy is in front", not "that proxy is Cloudflare". Traefik, Envoy and
    // nginx all pass cf-connecting-ip through untouched, so believing it ahead of the hop-counted
    // chain would hand the spoof straight back to the caller.
    test("ignores cf-connecting-ip in favour of the forwarded chain", () => {
      const headers = buildHeaders({
        "cf-connecting-ip": "198.51.100.5",
        "x-forwarded-for": "1.1.1.1, 203.0.113.7",
      });
      expect(resolveClientIp(headers, 1)).toBe("203.0.113.7");
    });

    test("ignores cf-connecting-ip even when it is the only header present", () => {
      const headers = buildHeaders({ "cf-connecting-ip": "198.51.100.5" });
      expect(resolveClientIp(headers, 1)).toBe(UNTRUSTED_CLIENT_IP);
    });

    test("trims whitespace around the selected entry", () => {
      const headers = buildHeaders({ "x-forwarded-for": "  1.1.1.1  ,   203.0.113.7  " });
      expect(resolveClientIp(headers, 1)).toBe("203.0.113.7");
    });

    // Regression: x-real-ip is only ever reached when no XFF arrived, which means the request did not
    // come through the proxy this app is configured to trust — so the header is caller-supplied, and
    // honouring it would hand back the per-request bucket rotation this function exists to stop.
    test("ignores x-real-ip when there is no forwarded chain", () => {
      const headers = buildHeaders({ "x-real-ip": "203.0.113.9" });
      expect(resolveClientIp(headers, 1)).toBe(UNTRUSTED_CLIENT_IP);
    });

    test("ignores x-real-ip even when a forwarded chain is present", () => {
      const headers = buildHeaders({
        "x-forwarded-for": "1.1.1.1, 203.0.113.7",
        "x-real-ip": "9.9.9.9",
      });
      expect(resolveClientIp(headers, 1)).toBe("203.0.113.7");
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

  // At the shipped default of 1, the address is the entry the single trusted proxy appended, and the
  // client-supplied prefix and `cf-connecting-ip` are both ignored.
  test("takes the trusted proxy's entry at the default hop count of 1", async () => {
    mockHeaders({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 203.0.113.7" });
    await expect(getClientIpFromHeaders()).resolves.toBe("203.0.113.7");
  });

  test("reports the client as untrusted when no header identifies it", async () => {
    mockHeaders({});
    await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
  });

  test("handles errors when headers() throws an exception", async () => {
    vi.mocked(nextHeaders.headers).mockImplementation(() => {
      throw new Error("Failed to get headers");
    });

    await expect(getClientIpFromHeaders()).resolves.toBe(UNTRUSTED_CLIENT_IP);
  });
});

describe("misconfiguration warning", () => {
  // The throttle timestamp is module-level state, so each case re-imports the module to get a fresh
  // one. The logger has to be imported *after* the reset too, or it would be a different mock instance
  // than the one the re-imported module captured.
  const loadFresh = async () => {
    vi.resetModules();
    const { logger } = await import("@formbricks/logger");
    const { resolveClientIp: freshResolveClientIp } = await import("./client-ip");
    return { logger, freshResolveClientIp };
  };

  test("warns once per throttle window when forwarding headers arrive but no hop is trusted", async () => {
    const { logger, freshResolveClientIp } = await loadFresh();
    const headers = buildHeaders({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });

    freshResolveClientIp(headers, 0);
    freshResolveClientIp(headers, 0);
    freshResolveClientIp(buildHeaders({ "cf-connecting-ip": "1.1.1.1" }), 0);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.error).mock.calls[0][0]).toContain("TRUSTED_PROXY_HOP_COUNT");
  });

  // The point of the time window over a once-per-process flag: an operator who leaves
  // TRUSTED_PROXY_HOP_COUNT=0 keeps getting a signal, instead of one line at boot and silence after.
  test("warns again after the throttle window elapses", async () => {
    const { logger, freshResolveClientIp } = await loadFresh();
    const headers = buildHeaders({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });

    vi.useFakeTimers();
    try {
      freshResolveClientIp(headers, 0);
      expect(logger.error).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(9 * 60 * 1000);
      freshResolveClientIp(headers, 0);
      expect(logger.error).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2 * 60 * 1000);
      freshResolveClientIp(headers, 0);
      expect(logger.error).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("stays quiet when the request carries no forwarding header at all", async () => {
    const { logger, freshResolveClientIp } = await loadFresh();

    expect(freshResolveClientIp(buildHeaders({}), 0)).toBe(UNTRUSTED_CLIENT_IP);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("stays quiet when a hop is trusted", async () => {
    const { logger, freshResolveClientIp } = await loadFresh();

    freshResolveClientIp(buildHeaders({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }), 1);

    expect(logger.error).not.toHaveBeenCalled();
  });
});
