import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TIntegrationAirtableTables } from "@formbricks/types/integration/airtable";
import { authorize, fetchTables } from "./airtable";

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

const environmentId = "test-env-id";
const baseId = "test-base-id";
const apiHost = "http://localhost:3000";

describe("Airtable Library", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchTables", () => {
    test("should fetch tables successfully", async () => {
      const mockTables: TIntegrationAirtableTables = {
        tables: [
          { id: "tbl1", name: "Table 1" },
          { id: "tbl2", name: "Table 2" },
        ],
      };
      const mockResponse = {
        ok: true,
        json: async () => ({ data: mockTables }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const tables = await fetchTables(environmentId, baseId);

      expect(fetch).toHaveBeenCalledWith(`/api/v1/integrations/airtable/tables?baseId=${baseId}`, {
        method: "GET",
        headers: { environmentId: environmentId },
        cache: "no-store",
      });
      expect(tables).toEqual(mockTables);
    });
  });

  describe("authorize", () => {
    test("should return authUrl successfully", async () => {
      const mockAuthUrl = "https://airtable.com/oauth2/v1/authorize?...";
      const mockResponse = {
        ok: true,
        json: async () => ({ data: { authUrl: mockAuthUrl } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const authUrl = await authorize(environmentId, apiHost);

      expect(fetch).toHaveBeenCalledWith(`${apiHost}/api/v1/integrations/airtable`, {
        method: "GET",
        headers: { environmentId: environmentId },
      });
      expect(authUrl).toBe(mockAuthUrl);
    });

    test("should throw error and log when fetch fails", async () => {
      const errorText = "Failed to fetch";
      const mockResponse = {
        ok: false,
        text: async () => errorText,
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(authorize(environmentId, apiHost)).rejects.toThrow("Could not create response");

      expect(fetch).toHaveBeenCalledWith(`${apiHost}/api/v1/integrations/airtable`, {
        method: "GET",
        headers: { environmentId: environmentId },
      });
      expect(logger.error).toHaveBeenCalledWith({ errorText }, "authorize: Could not fetch airtable config");
    });
  });
});
