import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { POST } from "./route";

/**
 * The client events endpoint (ENG-4000). Its boundaries are replaced: the IP rate limiter, the
 * workspace's creatives (the database behind the 60 s cache) and the Redis counters. Every request
 * answers 204; what a test checks is what reached the counters.
 */

const mocks = vi.hoisted(() => ({
  applyIPRateLimit: vi.fn(),
  findWorkspaceByIdOrLegacyEnvId: vi.fn(),
  findCreatives: vi.fn(),
  incrementCreativeCounters: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: mocks.applyIPRateLimit }));
vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: mocks.findWorkspaceByIdOrLegacyEnvId,
}));
vi.mock("@formbricks/database", () => ({ prisma: { creative: { findMany: mocks.findCreatives } } }));
vi.mock("@/lib/cache", () => ({
  cache: { withCache: async <T>(fn: () => Promise<T>) => fn() },
}));
vi.mock("@/modules/creatives/lib/counters", () => ({
  incrementCreativeCounters: mocks.incrementCreativeCounters,
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: mocks.warn, error: vi.fn(), debug: vi.fn() } }));

const WORKSPACE_ID = "clws1234567890123456789012";
const BUTTON_ID = "clcr1234567890123456789012";
const BANNER_ID = "clcb1234567890123456789012";
const FOREIGN_ID = "clcf1234567890123456789012";
const BROWSER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const send = (
  body: unknown,
  {
    userAgent = BROWSER,
    workspaceId = WORKSPACE_ID,
  }: { userAgent?: string | null; workspaceId?: string } = {}
) =>
  POST(
    new Request(`https://app.formbricks.test/api/v2/client/${workspaceId}/creatives/events`, {
      method: "POST",
      // What `fetch(…, { keepalive: true, body: string })` sends: no JSON content type, so no preflight.
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        ...(userAgent ? { "User-Agent": userAgent } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ workspaceId }) }
  );

const pageView = (events: { creativeId: string; type: "impression" | "click" }[]) => ({
  page: "example.com/pricing",
  deviceType: "phone",
  events,
});

const counted = () => mocks.incrementCreativeCounters.mock.calls.map(([counts]) => counts);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.applyIPRateLimit.mockResolvedValue({ allowed: true });
  mocks.findWorkspaceByIdOrLegacyEnvId.mockResolvedValue({ id: WORKSPACE_ID, organizationId: "clorg" });
  mocks.findCreatives.mockResolvedValue([{ id: BUTTON_ID }, { id: BANNER_ID }]);
  mocks.incrementCreativeCounters.mockResolvedValue(true);
});

describe("POST /api/v2/client/[workspaceId]/creatives/events", () => {
  test("counts a page view's Impressions and Clicks per creative, and answers 204 with CORS", async () => {
    const response = await send(
      pageView([
        { creativeId: BUTTON_ID, type: "impression" },
        { creativeId: BANNER_ID, type: "impression" },
        { creativeId: BUTTON_ID, type: "click" },
        { creativeId: BUTTON_ID, type: "click" },
      ])
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.text()).toBe("");
    expect(counted()).toEqual([
      {
        page: "example.com/pricing",
        deviceType: "phone",
        creatives: [
          { creativeId: BUTTON_ID, impressions: 1, clicks: 2 },
          { creativeId: BANNER_ID, impressions: 1, clicks: 0 },
        ],
      },
    ]);
  });

  test("counts one Impression per creative and page view, however many the request repeats", async () => {
    await send(
      pageView([
        { creativeId: BUTTON_ID, type: "impression" },
        { creativeId: BUTTON_ID, type: "impression" },
      ])
    );

    expect(counted()[0].creatives).toEqual([{ creativeId: BUTTON_ID, impressions: 1, clicks: 0 }]);
  });

  test("drops events for creatives the workspace doesn't have, and counts the rest", async () => {
    await send(
      pageView([
        { creativeId: FOREIGN_ID, type: "impression" },
        { creativeId: BUTTON_ID, type: "click" },
      ])
    );

    expect(counted()[0].creatives).toEqual([{ creativeId: BUTTON_ID, impressions: 0, clicks: 1 }]);
    expect(mocks.findCreatives).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WORKSPACE_ID, archivedAt: null, publishedAt: { not: null } },
      })
    );
  });

  test("counts nothing for an unknown workspace or when no event names a known creative", async () => {
    mocks.findWorkspaceByIdOrLegacyEnvId.mockResolvedValueOnce(null);
    expect((await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]))).status).toBe(204);

    expect((await send(pageView([{ creativeId: FOREIGN_ID, type: "impression" }]))).status).toBe(204);

    expect(mocks.incrementCreativeCounters).not.toHaveBeenCalled();
  });

  test.each([
    ["a bot", BOT],
    ["a client without a user agent", null],
  ])("counts nothing from %s", async (_name, userAgent) => {
    const response = await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]), { userAgent });

    expect(response.status).toBe(204);
    expect(mocks.incrementCreativeCounters).not.toHaveBeenCalled();
    expect(mocks.applyIPRateLimit).not.toHaveBeenCalled();
  });

  test("counts nothing over the IP rate limit, still answering 204", async () => {
    mocks.applyIPRateLimit.mockRejectedValueOnce(new TooManyRequestsError("Too many requests", 60));

    const response = await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]));

    expect(response.status).toBe(204);
    expect(mocks.applyIPRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ allowedPerInterval: 600, namespace: "api:client:creative-events" })
    );
    expect(mocks.incrementCreativeCounters).not.toHaveBeenCalled();
  });

  test.each([
    ["malformed JSON", "{"],
    ["no events", pageView([])],
    ["an unknown event type", pageView([{ creativeId: BUTTON_ID, type: "dismiss" as "click" }])],
    ["an unknown device type", { ...pageView([{ creativeId: BUTTON_ID, type: "click" }]), deviceType: "tv" }],
    ["a page without a host", { ...pageView([{ creativeId: BUTTON_ID, type: "click" }]), page: "/pricing" }],
    [
      "a page named like the bucket of uncounted pages",
      { ...pageView([{ creativeId: BUTTON_ID, type: "click" }]), page: "(other)" },
    ],
    [
      "more than 100 events",
      pageView(Array.from({ length: 101 }, () => ({ creativeId: BUTTON_ID, type: "click" as const }))),
    ],
  ])("counts nothing for %s", async (_name, body) => {
    const response = await send(body);

    expect(response.status).toBe(204);
    expect(mocks.incrementCreativeCounters).not.toHaveBeenCalled();
  });

  test("counts nothing for a workspace id that isn't one", async () => {
    const response = await send(pageView([{ creativeId: BUTTON_ID, type: "click" }]), {
      workspaceId: "not-an-id!",
    });

    expect(response.status).toBe(204);
    expect(mocks.findWorkspaceByIdOrLegacyEnvId).not.toHaveBeenCalled();
    expect(mocks.incrementCreativeCounters).not.toHaveBeenCalled();
  });

  test("answers 204 when Redis refuses the write, and logs it", async () => {
    mocks.incrementCreativeCounters.mockRejectedValueOnce(
      new Error("OOM command not allowed when used memory > 'maxmemory'")
    );

    const response = await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]));

    expect(response.status).toBe(204);
    expect(mocks.warn).toHaveBeenCalledOnce();
  });
});
