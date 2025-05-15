import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { describe, expect, test, vi } from "vitest";
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
  test("should return authentication data if apiKey is valid", async () => {
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
          environment: {
            id: "env-id-1",
            projectId: "project-id-1",
            type: "development",
            project: { name: "Project 1" },
          },
        },
        {
          environmentId: "env-id-2",
          permission: "read",
          environment: {
            id: "env-id-2",
            projectId: "project-id-2",
            type: "production",
            project: { name: "Project 2" },
          },
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
          {
            environmentId: "env-id-1",
            permission: "manage",
            environmentType: "development",
            projectId: "project-id-1",
            projectName: "Project 1",
          },
          {
            environmentId: "env-id-2",
            permission: "read",
            environmentType: "production",
            projectId: "project-id-2",
            projectName: "Project 2",
          },
        ],
        hashedApiKey: "hashed-api-key",
        apiKeyId: "api-key-id",
        organizationId: "org-id",
      });
    }
  });

  test("should return unauthorized error if apiKey is not found", async () => {
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

  test("should return unauthorized error if apiKey is missing", async () => {
    const request = new Request("http://localhost");

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }
  });
});
