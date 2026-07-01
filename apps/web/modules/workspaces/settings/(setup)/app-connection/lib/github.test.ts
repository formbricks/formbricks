import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

vi.mock("@/lib/constants", () => ({
  GITHUB_TOKEN: "test-token",
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const RELEASE_URL = "https://api.github.com/repos/formbricks/formbricks/releases/latest";

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

  test("sends the Authorization header when GITHUB_TOKEN is set", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ tag_name: "v3.0.0" }));

    const { getLatestStableFbRelease } = await import("./github");
    await getLatestStableFbRelease();

    expect(global.fetch).toHaveBeenCalledWith(
      RELEASE_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
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
});
