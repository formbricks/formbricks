import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { POST } from "./route";

/**
 * The test delivery through the real `testEndpoint` and its SSRF validation: only the caller's authorization
 * and the network are stubbed, so a URL the validator refuses is proven never to be requested.
 */

const mocks = vi.hoisted(() => ({ can: vi.fn(), getSession: vi.fn(), fetch: vi.fn() }));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: false,
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const WORKSPACE_ID = "clwork1111111111111111111";

const testDelivery = (url: string) =>
  POST(
    new NextRequest(`http://localhost/api/internal/webhooks/test-deliveries?workspaceId=${WORKSPACE_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
      body: JSON.stringify({ url }),
    }),
    { params: Promise.resolve({}) } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "cluser1111111111111111111" } });
  mocks.can.mockResolvedValue(true);
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/internal/webhooks/test-deliveries, SSRF guard", () => {
  test.each([
    ["loopback", "http://127.0.0.1/hook", "Webhook URL must not point to private or internal IP addresses"],
    [
      "the cloud metadata address",
      "http://169.254.169.254/latest/meta-data",
      "Webhook URL must not point to private or internal IP addresses",
    ],
    [
      "an IPv4-mapped loopback",
      "http://[::ffff:127.0.0.1]/hook",
      "Webhook URL must not point to private or internal IP addresses",
    ],
    [
      "localhost",
      "http://localhost:3000/hook",
      "Webhook URL must not point to localhost or internal services",
    ],
    ["a non-HTTP scheme", "file:///etc/passwd", "Webhook URL must use HTTPS or HTTP protocol"],
  ])("refuses %s with 422 and sends nothing", async (_label, url, reason) => {
    const response = await testDelivery(url);

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(reason);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
