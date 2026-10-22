import { headers } from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_CLIENT_IP_HEADER, UNTRUSTED_CLIENT_IP, resolveClientIp } from "@/lib/utils/client-ip";
import { getAuditRequestMetadata, sanitizeAuditUserAgent } from "./request-metadata";

const { flags } = vi.hoisted(() => ({ flags: { captureIp: true } }));
vi.mock("@/lib/constants", () => ({
  get AUDIT_LOG_GET_USER_IP() {
    return flags.captureIp;
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  flags.captureIp = true;
});

describe("sanitizeAuditUserAgent", () => {
  test.each([null, "", "  ", "\u0000\n\t\u007f\u0085"])("uses unknown for %j", (value) => {
    expect(sanitizeAuditUserAgent(value)).toBe("unknown");
  });

  test("strips controls, trims whitespace, and bounds arbitrary client input", () => {
    expect(sanitizeAuditUserAgent("  Agent\t/1\u001b\r\n  ")).toBe("Agent/1");
    expect(sanitizeAuditUserAgent("a".repeat(2048))).toBe("a".repeat(1024));
  });
});

describe("getAuditRequestMetadata", () => {
  test("reads the Proxy identity and user agent from the supplied snapshot", async () => {
    const snapshot = new Headers({
      [FORMBRICKS_CLIENT_IP_HEADER]: "::ffff:203.0.113.7",
      "user-agent": "curl/8.0",
      "x-forwarded-for": "192.0.2.99",
    });
    await expect(getAuditRequestMetadata(snapshot)).resolves.toEqual({
      ipAddress: "203.0.113.7",
      userAgent: "curl/8.0",
    });
    expect(headers).not.toHaveBeenCalled();
  });

  test("reads the active request when no snapshot is supplied", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        [FORMBRICKS_CLIENT_IP_HEADER]: "203.0.113.7",
        "user-agent": "Browser/1",
      }) as never
    );
    await expect(getAuditRequestMetadata()).resolves.toEqual({
      ipAddress: "203.0.113.7",
      userAgent: "Browser/1",
    });
  });

  test.each([undefined, "invalid", "203.0.113.7, 192.0.2.1"])(
    "never falls back to raw forwarding headers for private identity %j",
    async (privateIp) => {
      const snapshot = new Headers({
        "x-forwarded-for": "203.0.113.7",
        "cf-connecting-ip": "203.0.113.7",
        "x-real-ip": "203.0.113.7",
      });
      if (privateIp !== undefined) snapshot.set(FORMBRICKS_CLIENT_IP_HEADER, privateIp);
      await expect(getAuditRequestMetadata(snapshot)).resolves.toEqual({
        ipAddress: UNTRUSTED_CLIENT_IP,
        userAgent: "unknown",
      });
    }
  );

  test("matches the rate-limit resolver's IPv6 network identity", async () => {
    const address = "2001:db8:abcd:12::99";
    const rateLimitIp = resolveClientIp(new Headers({ "x-forwarded-for": address }), 1);
    const metadata = await getAuditRequestMetadata(new Headers({ [FORMBRICKS_CLIENT_IP_HEADER]: address }));
    expect(metadata.ipAddress).toBe(rateLimitIp);
    expect(metadata.ipAddress).toBe("2001:0db8:abcd:0012:0000:0000:0000:0000");
  });

  test("retains user agent when IP capture is opted out", async () => {
    flags.captureIp = false;
    await expect(
      getAuditRequestMetadata(
        new Headers({
          [FORMBRICKS_CLIENT_IP_HEADER]: "203.0.113.7",
          "user-agent": "Agent/1",
        })
      )
    ).resolves.toEqual({ ipAddress: "unknown", userAgent: "Agent/1" });
  });

  test.each([true, false])(
    "keeps fallback metadata when request headers fail and capture=%s",
    async (captureIp) => {
      flags.captureIp = captureIp;
      vi.mocked(headers).mockRejectedValue(new Error("request has ended"));
      await expect(getAuditRequestMetadata()).resolves.toEqual({
        ipAddress: captureIp ? UNTRUSTED_CLIENT_IP : "unknown",
        userAgent: "unknown",
      });
    }
  );
});
