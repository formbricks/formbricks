import { describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { authorize } from "./slack";

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe("authorize", () => {
  const environmentId = "test-env-id";
  const apiHost = "http://test.com";
  const expectedUrl = `${apiHost}/api/v1/integrations/slack`;
  const expectedAuthUrl = "http://slack.com/auth";

  test("should return authUrl on successful fetch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { authUrl: expectedAuthUrl } }),
    } as Response);

    const authUrl = await authorize(environmentId, apiHost);

    expect(fetch).toHaveBeenCalledWith(expectedUrl, {
      method: "GET",
      headers: { environmentId },
    });
    expect(authUrl).toBe(expectedAuthUrl);
  });

  test("should throw error and log error on failed fetch", async () => {
    const errorText = "Failed to fetch";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: async () => errorText,
    } as Response);

    await expect(authorize(environmentId, apiHost)).rejects.toThrow("Could not create response");

    expect(fetch).toHaveBeenCalledWith(expectedUrl, {
      method: "GET",
      headers: { environmentId },
    });
    expect(logger.error).toHaveBeenCalledWith({ errorText }, "authorize: Could not fetch slack config");
  });
});
