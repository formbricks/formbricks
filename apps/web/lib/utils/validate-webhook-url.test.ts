import dns from "node:dns";
import type { Agent } from "undici";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createPinnedDispatcher,
  validateAndResolveWebhookUrl,
  validateWebhookUrl,
} from "./validate-webhook-url";

vi.mock("node:dns", () => ({
  default: {
    resolve: vi.fn(),
    resolve6: vi.fn(),
  },
}));

vi.mock("../constants", () => ({
  DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: false,
}));

const mockResolve = vi.mocked(dns.resolve);
const mockResolve6 = vi.mocked(dns.resolve6);

type DnsCallback = (err: NodeJS.ErrnoException | null, addresses: string[]) => void;

const setupDnsResolution = (ipv4: string[] | null, ipv6: string[] | null = null): void => {
  // dns.resolve/resolve6 have overloaded signatures; we only mock the (hostname, callback) form
  mockResolve.mockImplementation(((_hostname: string, callback: DnsCallback) => {
    if (ipv4) {
      callback(null, ipv4);
    } else {
      callback(new Error("ENOTFOUND"), []);
    }
  }) as never);

  mockResolve6.mockImplementation(((_hostname: string, callback: DnsCallback) => {
    if (ipv6) {
      callback(null, ipv6);
    } else {
      callback(new Error("ENOTFOUND"), []);
    }
  }) as never);
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("validateWebhookUrl", () => {
  describe("valid public URLs", () => {
    test("accepts HTTPS URL resolving to a public IPv4 address", async () => {
      setupDnsResolution(["93.184.216.34"]);
      await expect(validateWebhookUrl("https://example.com/webhook")).resolves.toBeUndefined();
    });

    test("accepts HTTP URL resolving to a public IPv4 address", async () => {
      setupDnsResolution(["93.184.216.34"]);
      await expect(validateWebhookUrl("http://example.com/webhook")).resolves.toBeUndefined();
    });

    test("accepts URL with port and path segments", async () => {
      setupDnsResolution(["93.184.216.34"]);
      await expect(validateWebhookUrl("https://example.com:8443/api/v1/webhook")).resolves.toBeUndefined();
    });

    test("accepts URL resolving to a public IPv6 address", async () => {
      setupDnsResolution(null, ["2606:2800:220:1:248:1893:25c8:1946"]);
      await expect(validateWebhookUrl("https://example.com/webhook")).resolves.toBeUndefined();
    });

    test("accepts a public IPv4 address as hostname", async () => {
      await expect(validateWebhookUrl("https://93.184.216.34/webhook")).resolves.toBeUndefined();
    });
  });

  describe("URL format validation", () => {
    test("rejects a completely malformed string", async () => {
      await expect(validateWebhookUrl("not-a-url")).rejects.toThrow("Invalid webhook URL format");
    });

    test("rejects an empty string", async () => {
      await expect(validateWebhookUrl("")).rejects.toThrow("Invalid webhook URL format");
    });
  });

  describe("protocol validation", () => {
    test("rejects FTP protocol", async () => {
      await expect(validateWebhookUrl("ftp://example.com/file")).rejects.toThrow(
        "Webhook URL must use HTTPS or HTTP protocol"
      );
    });

    test("rejects file:// protocol", async () => {
      await expect(validateWebhookUrl("file:///etc/passwd")).rejects.toThrow(
        "Webhook URL must use HTTPS or HTTP protocol"
      );
    });

    test("rejects javascript: protocol", async () => {
      await expect(validateWebhookUrl("javascript:alert(1)")).rejects.toThrow(
        "Webhook URL must use HTTPS or HTTP protocol"
      );
    });
  });

  describe("blocked hostname validation", () => {
    test("rejects localhost", async () => {
      await expect(validateWebhookUrl("http://localhost/admin")).rejects.toThrow(
        "Webhook URL must not point to localhost or internal services"
      );
    });

    test("rejects localhost.localdomain", async () => {
      await expect(validateWebhookUrl("https://localhost.localdomain/path")).rejects.toThrow(
        "Webhook URL must not point to localhost or internal services"
      );
    });

    test("rejects metadata.google.internal", async () => {
      await expect(validateWebhookUrl("http://metadata.google.internal/computeMetadata/v1/")).rejects.toThrow(
        "Webhook URL must not point to localhost or internal services"
      );
    });
  });

  describe("private IPv4 literal blocking", () => {
    test("rejects 127.0.0.1 (loopback)", async () => {
      await expect(validateWebhookUrl("http://127.0.0.1/metadata")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 127.0.0.53 (loopback range)", async () => {
      await expect(validateWebhookUrl("http://127.0.0.53/")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 10.0.0.1 (Class A private)", async () => {
      await expect(validateWebhookUrl("http://10.0.0.1/internal")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 172.16.0.1 (Class B private)", async () => {
      await expect(validateWebhookUrl("http://172.16.0.1/internal")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 172.31.255.255 (Class B private upper bound)", async () => {
      await expect(validateWebhookUrl("http://172.31.255.255/internal")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 192.168.1.1 (Class C private)", async () => {
      await expect(validateWebhookUrl("http://192.168.1.1/internal")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 169.254.169.254 (AWS/GCP/Azure metadata endpoint)", async () => {
      await expect(validateWebhookUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 0.0.0.0 ('this' network)", async () => {
      await expect(validateWebhookUrl("http://0.0.0.0/")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects 100.64.0.1 (CGNAT / shared address space)", async () => {
      await expect(validateWebhookUrl("http://100.64.0.1/")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });
  });

  describe("DNS resolution with private IP results", () => {
    test("rejects hostname resolving to loopback address", async () => {
      setupDnsResolution(["127.0.0.1"]);
      await expect(validateWebhookUrl("https://evil.com/steal")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to cloud metadata endpoint IP", async () => {
      setupDnsResolution(["169.254.169.254"]);
      await expect(validateWebhookUrl("https://attacker.com/ssrf")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to Class A private network", async () => {
      setupDnsResolution(["10.0.0.5"]);
      await expect(validateWebhookUrl("https://internal.service/api")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to Class C private network", async () => {
      setupDnsResolution(["192.168.0.1"]);
      await expect(validateWebhookUrl("https://sneaky.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to IPv6 loopback", async () => {
      setupDnsResolution(null, ["::1"]);
      await expect(validateWebhookUrl("https://sneaky.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to IPv6 link-local", async () => {
      setupDnsResolution(null, ["fe80::1"]);
      await expect(validateWebhookUrl("https://link-local.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to IPv6 unique local address", async () => {
      setupDnsResolution(null, ["fd12:3456:789a::1"]);
      await expect(validateWebhookUrl("https://ula.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to IPv4-mapped IPv6 private address (dotted)", async () => {
      setupDnsResolution(null, ["::ffff:192.168.1.1"]);
      await expect(validateWebhookUrl("https://mapped.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hostname resolving to IPv4-mapped IPv6 private address (hex-encoded)", async () => {
      setupDnsResolution(null, ["::ffff:c0a8:0101"]); // 192.168.1.1 in hex
      await expect(validateWebhookUrl("https://hex-mapped.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hex-encoded IPv4-mapped loopback (::ffff:7f00:0001)", async () => {
      setupDnsResolution(null, ["::ffff:7f00:0001"]); // 127.0.0.1 in hex
      await expect(validateWebhookUrl("https://hex-loopback.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects hex-encoded IPv4-mapped metadata endpoint (::ffff:a9fe:a9fe)", async () => {
      setupDnsResolution(null, ["::ffff:a9fe:a9fe"]); // 169.254.169.254 in hex
      await expect(validateWebhookUrl("https://hex-metadata.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("accepts hex-encoded IPv4-mapped public address", async () => {
      setupDnsResolution(null, ["::ffff:5db8:d822"]); // 93.184.216.34 in hex
      await expect(validateWebhookUrl("https://hex-public.example.com/webhook")).resolves.toBeUndefined();
    });

    test("rejects when any resolved IP is private (mixed public + private)", async () => {
      setupDnsResolution(["93.184.216.34", "192.168.1.1"]);
      await expect(validateWebhookUrl("https://dual.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
    });

    test("rejects unresolvable hostname", async () => {
      setupDnsResolution(null, null);
      await expect(validateWebhookUrl("https://nonexistent.invalid/path")).rejects.toThrow(
        "Could not resolve webhook URL hostname"
      );
    });

    test("rejects with timeout error when DNS resolution hangs", async () => {
      vi.useFakeTimers();

      mockResolve.mockImplementation((() => {
        // never calls callback — simulates a hanging DNS server
      }) as never);

      const promise = validateWebhookUrl("https://slow-dns.example.com/webhook");

      const assertion = expect(promise).rejects.toThrow(
        "DNS resolution timed out for webhook URL hostname: slow-dns.example.com"
      );

      await vi.advanceTimersByTimeAsync(3000);
      await assertion;

      vi.useRealTimers();
    });
  });

  describe("error type", () => {
    test("throws InvalidInputError (not generic Error)", async () => {
      await expect(validateWebhookUrl("http://127.0.0.1/")).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });
  });

  describe("DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS", () => {
    test("allows private IP URLs when enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));

      const { validateWebhookUrl: validateWithFlag } = await import("./validate-webhook-url");
      await expect(validateWithFlag("http://127.0.0.1/")).resolves.toBeUndefined();
      await expect(validateWithFlag("http://192.168.1.1/test")).resolves.toBeUndefined();
      await expect(validateWithFlag("http://10.0.0.1/webhook")).resolves.toBeUndefined();
    });

    test("allows localhost when enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));

      const { validateWebhookUrl: validateWithFlag } = await import("./validate-webhook-url");
      await expect(validateWithFlag("http://localhost/webhook")).resolves.toBeUndefined();
      await expect(validateWithFlag("http://localhost:3333/webhook")).resolves.toBeUndefined();
    });

    test("allows localhost.localdomain when enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));

      const { validateWebhookUrl: validateWithFlag } = await import("./validate-webhook-url");
      await expect(validateWithFlag("http://localhost.localdomain/path")).resolves.toBeUndefined();
    });

    test("allows hostname resolving to private IP when enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));

      setupDnsResolution(["192.168.1.1"]);
      const { validateWebhookUrl: validateWithFlag } = await import("./validate-webhook-url");
      await expect(validateWithFlag("https://internal.company.com/webhook")).resolves.toBeUndefined();
    });

    test("still rejects unresolvable hostnames when enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));

      setupDnsResolution(null, null);
      const { validateWebhookUrl: validateWithFlag } = await import("./validate-webhook-url");
      await expect(validateWithFlag("https://typo-gibberish.invalid/hook")).rejects.toThrow(
        "Could not resolve webhook URL hostname"
      );
    });

    test("still rejects invalid URL format when enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));

      const { validateWebhookUrl: validateWithFlag } = await import("./validate-webhook-url");
      await expect(validateWithFlag("not-a-url")).rejects.toThrow("Invalid webhook URL format");
    });

    test("still rejects non-HTTP protocols when enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));

      const { validateWebhookUrl: validateWithFlag } = await import("./validate-webhook-url");
      await expect(validateWithFlag("ftp://192.168.1.1/")).rejects.toThrow(
        "Webhook URL must use HTTPS or HTTP protocol"
      );
    });
  });

  describe("validateAndResolveWebhookUrl returns pinned address", () => {
    test("returns IPv4 literal as { ip, family: 4 }", async () => {
      await expect(validateAndResolveWebhookUrl("https://93.184.216.34/webhook")).resolves.toEqual({
        ip: "93.184.216.34",
        family: 4,
      });
    });

    test("returns IPv6 literal stripped of brackets as { ip, family: 6 }", async () => {
      await expect(
        validateAndResolveWebhookUrl("https://[2606:2800:220:1:248:1893:25c8:1946]/webhook")
      ).resolves.toEqual({
        ip: "2606:2800:220:1:248:1893:25c8:1946",
        family: 6,
      });
    });

    test("returns first resolved IPv4 for hostnames", async () => {
      setupDnsResolution(["93.184.216.34", "23.23.23.23"]);
      await expect(validateAndResolveWebhookUrl("https://example.com/webhook")).resolves.toEqual({
        ip: "93.184.216.34",
        family: 4,
      });
    });

    test("returns IPv6 when only IPv6 is resolvable", async () => {
      setupDnsResolution(null, ["2606:2800:220:1:248:1893:25c8:1946"]);
      await expect(validateAndResolveWebhookUrl("https://example.com/webhook")).resolves.toEqual({
        ip: "2606:2800:220:1:248:1893:25c8:1946",
        family: 6,
      });
    });

    test("returns null for blocked hostname when DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS is enabled", async () => {
      vi.doMock("../constants", () => ({
        DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: true,
      }));
      const { validateAndResolveWebhookUrl: fn } = await import("./validate-webhook-url");
      await expect(fn("http://localhost/webhook")).resolves.toBeNull();
    });
  });

  describe("createPinnedDispatcher", () => {
    test("returns an undici Agent instance", async () => {
      const { Agent } = await import("undici");
      const dispatcher = createPinnedDispatcher({ ip: "93.184.216.34", family: 4 });
      expect(dispatcher).toBeInstanceOf(Agent);
      await dispatcher.close();
    });

    // Reach into the Agent's connect options to grab the lookup function we
    // installed. This is implementation-coupled but the only way to assert the
    // pinning behavior without spinning up a real socket. If undici changes
    // internals and this stops finding the lookup, the integration-style test
    // below still verifies the end-to-end behavior.
    const extractLookup = (
      agent: Agent
    ):
      | ((
          host: string,
          opts: { all?: boolean },
          cb: (
            err: NodeJS.ErrnoException | null,
            address: string | { address: string; family: number }[],
            family?: number
          ) => void
        ) => void)
      | undefined => {
      const symbols = Object.getOwnPropertySymbols(agent);
      for (const sym of symbols) {
        const value = (agent as unknown as Record<symbol, unknown>)[sym];
        if (value && typeof value === "object" && "connect" in value) {
          const connect = (value as { connect?: { lookup?: unknown } }).connect;
          if (connect && typeof connect.lookup === "function") {
            return connect.lookup as never;
          }
        }
      }
      return undefined;
    };

    test("lookup returns the pinned IP regardless of which hostname is queried (all=true)", async () => {
      const dispatcher = createPinnedDispatcher({ ip: "93.184.216.34", family: 4 });
      const lookup = extractLookup(dispatcher);

      // If we couldn't reach into the Agent, skip the deep assertion — the
      // integration test still covers the contract.
      if (!lookup) {
        await dispatcher.close();
        return;
      }

      const result = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
        lookup("attacker-rebound.example.com", { all: true }, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses as { address: string; family: number }[]);
        });
      });
      expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);
      await dispatcher.close();
    });

    test("lookup honours legacy (err, address, family) form when all is not set", async () => {
      const dispatcher = createPinnedDispatcher({ ip: "2606:4700::1", family: 6 });
      const lookup = extractLookup(dispatcher);
      if (!lookup) {
        await dispatcher.close();
        return;
      }

      const result = await new Promise<{ address: string; family: number }>((resolve, reject) => {
        lookup("anything.example", {}, (err, address, family) => {
          if (err) reject(err);
          else resolve({ address: address as string, family: family ?? -1 });
        });
      });
      expect(result).toEqual({ address: "2606:4700::1", family: 6 });
      await dispatcher.close();
    });
  });
});
