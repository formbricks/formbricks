import dns from "node:dns";
import { afterEach, describe, expect, test, vi } from "vitest";
import { validateWebhookUrl } from "./validate-webhook-url";

vi.mock("node:dns", () => ({
  default: {
    resolve: vi.fn(),
    resolve6: vi.fn(),
  },
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

    test("rejects hostname resolving to IPv4-mapped IPv6 private address", async () => {
      setupDnsResolution(null, ["::ffff:192.168.1.1"]);
      await expect(validateWebhookUrl("https://mapped.example.com/webhook")).rejects.toThrow(
        "Webhook URL must not point to private or internal IP addresses"
      );
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
  });

  describe("error type", () => {
    test("throws InvalidInputError (not generic Error)", async () => {
      await expect(validateWebhookUrl("http://127.0.0.1/")).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });
  });
});
