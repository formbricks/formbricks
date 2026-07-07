import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

// Mirrors the real cache facade: get returns { ok, data } with data null on a
// miss, set stores plain JSON values and expires them after ttlMs.
const mockCacheStore = new Map<string, { value: unknown; expiresAt: number }>();

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(async (key: string) => {
      const entry = mockCacheStore.get(key);
      if (!entry || entry.expiresAt <= Date.now()) {
        mockCacheStore.delete(key);
        return { ok: true, data: null };
      }
      return { ok: true, data: entry.value };
    }),
    set: vi.fn(async (key: string, value: unknown, ttlMs: number) => {
      mockCacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
      return { ok: true };
    }),
  },
}));

vi.mock("@formbricks/cache", () => ({
  createCacheKey: {
    custom: (...args: string[]) => args.join(":"),
  },
}));

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const htmlResponse = (status = 403): Response =>
  new Response("<html>rate limited</html>", {
    status,
    headers: { "content-type": "text/html" },
  });

describe("getLatestStableFbRelease", () => {
  beforeEach(() => {
    mockCacheStore.clear();
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns tag_name for a valid release response", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ tag_name: "v3.0.0" }));

    const { getLatestStableFbRelease } = await import("./github");
    const result = await getLatestStableFbRelease();

    expect(result).toBe("v3.0.0");
  });

  test("returns null and warns when GitHub returns a non-ok status", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(htmlResponse(403));

    const { getLatestStableFbRelease } = await import("./github");
    const result = await getLatestStableFbRelease();

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("returns null and warns when GitHub returns non-JSON content", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response("<html>ok</html>", { status: 200, headers: { "content-type": "text/html" } })
    );

    const { getLatestStableFbRelease } = await import("./github");
    const result = await getLatestStableFbRelease();

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("returns null and warns when fetch rejects", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("network down"));

    const { getLatestStableFbRelease } = await import("./github");
    const result = await getLatestStableFbRelease();

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), expect.any(String));
  });

  test("returns null when the response has no tag_name", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({}));

    const { getLatestStableFbRelease } = await import("./github");
    const result = await getLatestStableFbRelease();

    expect(result).toBeNull();
  });

  test("caches the result and does not hit GitHub again within the TTL", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ tag_name: "v3.0.0" }));

    const { getLatestStableFbRelease } = await import("./github");
    const first = await getLatestStableFbRelease();
    const second = await getLatestStableFbRelease();

    expect(first).toBe("v3.0.0");
    expect(second).toBe("v3.0.0");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("re-fetches after a failure once the shorter failure TTL elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(htmlResponse(403))
      .mockResolvedValueOnce(jsonResponse({ tag_name: "v3.0.0" }));

    const { getLatestStableFbRelease } = await import("./github");

    // First call fails and caches null.
    expect(await getLatestStableFbRelease()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Within the failure TTL (5 min) the cached null is reused.
    vi.setSystemTime(new Date("2026-01-01T00:04:00Z"));
    expect(await getLatestStableFbRelease()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // After the failure TTL elapses, GitHub is queried again and recovers.
    vi.setSystemTime(new Date("2026-01-01T00:06:00Z"));
    expect(await getLatestStableFbRelease()).toBe("v3.0.0");
    expect(global.fetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
