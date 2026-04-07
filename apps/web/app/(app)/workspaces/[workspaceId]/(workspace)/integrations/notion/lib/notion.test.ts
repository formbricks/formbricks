import { afterEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { authorize } from "./notion";

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("authorize", () => {
  const environmentId = "test-env-id";
  const apiHost = "http://test.com";
  const expectedUrl = `${apiHost}/api/v1/integrations/notion`;
  const expectedHeaders = { environmentId: environmentId };

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return authUrl on successful fetch", async () => {
    const mockAuthUrl = "https://api.notion.com/v1/oauth/authorize?...";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { authUrl: mockAuthUrl } }),
    });

    const authUrl = await authorize(environmentId, apiHost);

    expect(mockFetch).toHaveBeenCalledWith(expectedUrl, {
      method: "GET",
      headers: expectedHeaders,
    });
    expect(authUrl).toBe(mockAuthUrl);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("should throw error and log on failed fetch", async () => {
    const errorText = "Failed to fetch";
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => errorText,
    });

    await expect(authorize(environmentId, apiHost)).rejects.toThrow("Could not create response");

    expect(mockFetch).toHaveBeenCalledWith(expectedUrl, {
      method: "GET",
      headers: expectedHeaders,
    });
    expect(logger.error).toHaveBeenCalledWith({ errorText }, "authorize: Could not fetch notion config");
  });
});
