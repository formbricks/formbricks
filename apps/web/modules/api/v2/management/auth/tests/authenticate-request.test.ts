import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { authenticateRequest } from "../authenticate-request";

vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  hashApiKey: vi.fn(),
}));

describe("authenticateRequest", () => {
  it("should return authentication data if apiKey is valid", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Test API Key",
      hashedKey: "hashed-api-key",
      apiKeyEnvironments: [
        {
          environmentId: "env-id-1",
          permission: "manage",
          environment: { id: "env-id-1" },
        },
        {
          environmentId: "env-id-2",
          permission: "read",
          environment: { id: "env-id-2" },
        },
      ],
    };

    vi.mocked(hashApiKey).mockReturnValue("hashed-api-key");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKeyData);
    vi.mocked(prisma.apiKey.update).mockResolvedValue(mockApiKeyData);

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        type: "apiKey",
        environmentPermissions: [
          { environmentId: "env-id-1", permission: "manage" },
          { environmentId: "env-id-2", permission: "read" },
        ],
        hashedApiKey: "hashed-api-key",
        apiKeyId: "api-key-id",
        organizationId: "org-id",
      });
    }
  });

  it("should return unauthorized error if apiKey is not found", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "invalid-api-key" },
    });
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }
  });

  it("should return unauthorized error if apiKey is missing", async () => {
    const request = new Request("http://localhost");

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }
  });
});
