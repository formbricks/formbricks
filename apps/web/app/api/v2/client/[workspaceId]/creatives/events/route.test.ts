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
  getIsCreativesEnabled: vi.fn(),
  incrementCreativeCounters: vi.fn(),
  withCache: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: mocks.applyIPRateLimit }));
vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: mocks.findWorkspaceByIdOrLegacyEnvId,
}));
vi.mock("@formbricks/database", () => ({ prisma: { creative: { findMany: mocks.findCreatives } } }));
vi.mock("@/lib/cache", () => ({ cache: { withCache: mocks.withCache } }));
// The cache key hashes the creative ids; the unit setup's `crypto` mock would give every set one hash.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsCreativesEnabled: mocks.getIsCreativesEnabled,
}));
vi.mock("@/modules/ee/creatives/lib/counters", () => ({
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

type TStoredCreative = Record<"id" | "workspaceId" | "status", string> &
  Record<"publishedAt" | "archivedAt", Date | null> & { updatedAt: Date };

const creative = (id: string, overrides: Partial<TStoredCreative> = {}): TStoredCreative => ({
  id,
  workspaceId: WORKSPACE_ID,
  status: "inProgress",
  publishedAt: new Date("2026-09-01T00:00:00Z"),
  archivedAt: null,
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const matches = (value: unknown, condition: unknown): boolean => {
  if (condition === null || typeof condition !== "object") return value === condition;
  if ("not" in condition) return value !== condition.not;
  if ("in" in condition && Array.isArray(condition.in)) return condition.in.includes(value);
  throw new Error(`Unsupported condition ${JSON.stringify(condition)}`);
};

/** Prisma's `findMany` over `stored`: `where` (equality, `null`, `{ not }`, `{ in }`), `orderBy`, `take`. */
const storeCreatives = (stored: TStoredCreative[]) =>
  mocks.findCreatives.mockImplementation(
    async ({
      where,
      orderBy,
      take,
    }: {
      where: Record<string, unknown>;
      orderBy?: { updatedAt: "asc" | "desc" };
      take?: number;
    }) => {
      const rows = stored.filter((row) =>
        Object.entries(where).every(([field, condition]) =>
          matches(row[field as keyof TStoredCreative], condition)
        )
      );
      if (orderBy) {
        const direction = orderBy.updatedAt === "desc" ? -1 : 1;
        rows.sort((a, b) => direction * (a.updatedAt.getTime() - b.updatedAt.getTime()));
      }
      return rows.slice(0, take).map(({ id }) => ({ id }));
    }
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.applyIPRateLimit.mockResolvedValue({ allowed: true });
  mocks.findWorkspaceByIdOrLegacyEnvId.mockResolvedValue({ id: WORKSPACE_ID, organizationId: "clorg" });
  storeCreatives([
    creative(BUTTON_ID),
    creative(BANNER_ID),
    creative(FOREIGN_ID, { workspaceId: "clwo1234567890123456789012" }),
  ]);
  mocks.withCache.mockImplementation(async <T>(fn: () => Promise<T>) => fn());
  mocks.getIsCreativesEnabled.mockResolvedValue(true);
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
  });

  test("drops a restored Draft's events, though it keeps the date it was first published", async () => {
    const RESTORED_ID = "clcd1234567890123456789012";
    storeCreatives([creative(BUTTON_ID), creative(RESTORED_ID, { status: "draft" })]);

    await send(
      pageView([
        { creativeId: RESTORED_ID, type: "click" },
        { creativeId: BUTTON_ID, type: "click" },
      ])
    );

    expect(counted()[0].creatives).toEqual([{ creativeId: BUTTON_ID, impressions: 0, clicks: 1 }]);
  });

  test("counts a creative still shown when the workspace has 1,000 newer closed ones", async () => {
    const closed = Array.from({ length: 1000 }, (_, index) =>
      creative(`clcl${String(index).padStart(22, "0")}`, {
        status: "completed",
        updatedAt: new Date("2026-10-20T00:00:00Z"),
      })
    );
    storeCreatives([creative(BUTTON_ID), ...closed]);

    await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]));

    expect(counted()).toEqual([
      expect.objectContaining({ creatives: [{ creativeId: BUTTON_ID, impressions: 1, clicks: 0 }] }),
    ]);
  });

  test("caches the lookup once per workspace and set of creatives, whatever their order or repeats", async () => {
    await send(
      pageView([
        { creativeId: BUTTON_ID, type: "impression" },
        { creativeId: BANNER_ID, type: "impression" },
      ])
    );
    await send(
      pageView([
        { creativeId: BANNER_ID, type: "impression" },
        { creativeId: BUTTON_ID, type: "click" },
        { creativeId: BANNER_ID, type: "click" },
      ])
    );
    await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]));

    const [first, reordered, other] = mocks.withCache.mock.calls.map(([, key]) => key as string);
    expect(first).toMatch(new RegExp(`^fb:env:${WORKSPACE_ID}:creative-ids:[0-9a-f]{64}$`));
    expect(reordered).toBe(first);
    expect(other).not.toBe(first);
  });

  test("counts nothing for an unknown workspace or when no event names a known creative", async () => {
    mocks.findWorkspaceByIdOrLegacyEnvId.mockResolvedValueOnce(null);
    expect((await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]))).status).toBe(204);

    expect((await send(pageView([{ creativeId: FOREIGN_ID, type: "impression" }]))).status).toBe(204);

    expect(mocks.incrementCreativeCounters).not.toHaveBeenCalled();
  });

  test("counts nothing while the licence doesn't include Creatives, still answering 204", async () => {
    mocks.getIsCreativesEnabled.mockResolvedValue(false);

    const response = await send(pageView([{ creativeId: BUTTON_ID, type: "impression" }]));

    expect(response.status).toBe(204);
    expect(mocks.getIsCreativesEnabled).toHaveBeenCalledWith("clorg");
    expect(mocks.findCreatives).not.toHaveBeenCalled();
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
