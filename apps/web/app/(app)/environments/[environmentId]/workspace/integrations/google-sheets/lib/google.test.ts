import { afterEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { authorize } from "./google";

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
  const expectedUrl = `${apiHost}/api/google-sheet`;
  const expectedHeaders = { environmentId: environmentId };

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return authUrl on successful fetch", async () => {
    const mockAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth?...";
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
    expect(logger.error).toHaveBeenCalledWith(
      { errorText },
      "authorize: Could not fetch google sheet config"
    );
  });
});
