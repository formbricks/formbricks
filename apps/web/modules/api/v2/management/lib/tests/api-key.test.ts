import { apiKey, environmentId } from "./__mocks__/api-key.mock";
import { getEnvironmentIdFromApiKey } from "@/modules/api/v2/management/lib/api-key";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";

vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  hashApiKey: vi.fn((input: string) => `hashed-${input}`),
}));

describe("getEnvironmentIdFromApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns a bad_request error if apiKey is empty", async () => {
    const result = await getEnvironmentIdFromApiKey("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("bad_request");
      expect(result.error.details).toEqual([
        { field: "apiKey", issue: "API key cannot be null or undefined." },
      ]);
    }
  });

  test("returns a not_found error when no apiKey record is found in the database", async () => {
    vi.mocked(hashApiKey).mockImplementation((input: string) => `hashed-${input}`);
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const result = await getEnvironmentIdFromApiKey(apiKey);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { hashedKey: `hashed-${apiKey}` },
      select: { environmentId: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
      expect(result.error.details).toEqual([{ field: "apiKey", issue: "not found" }]);
    }
  });

  test("returns ok with environmentId when a valid apiKey record is found", async () => {
    vi.mocked(hashApiKey).mockImplementation((input: string) => `hashed-${input}`);
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({ environmentId });

    const result = await getEnvironmentIdFromApiKey(apiKey);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { hashedKey: `hashed-${apiKey}` },
      select: { environmentId: true },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(environmentId);
    }
  });

  test("returns internal_server_error when an exception occurs during the database lookup", async () => {
    vi.mocked(hashApiKey).mockImplementation((input: string) => `hashed-${input}`);
    vi.mocked(prisma.apiKey.findUnique).mockRejectedValue(new Error("Database failure"));

    const result = await getEnvironmentIdFromApiKey(apiKey);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { hashedKey: `hashed-${apiKey}` },
      select: { environmentId: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("internal_server_error");
      expect(result.error.details).toEqual([{ field: "apiKey", issue: "Database failure" }]);
    }
  });
});
