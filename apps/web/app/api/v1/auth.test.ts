import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { authenticateRequest } from "./auth";

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

describe("getApiKeyWithPermissions", () => {
  test("returns API key data with permissions when valid key is provided", async () => {
    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      hashedKey: "hashed-key",
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Test API Key",
      apiKeyEnvironments: [
        {
          environmentId: "env-1",
          permission: "manage" as const,
          environment: { id: "env-1" },
        },
      ],
    };

    vi.mocked(hashApiKey).mockReturnValue("hashed-key");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKeyData);
    vi.mocked(prisma.apiKey.update).mockResolvedValue(mockApiKeyData);

    const result = await getApiKeyWithPermissions("test-api-key");

    expect(result).toEqual(mockApiKeyData);
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "api-key-id" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  test("returns null when API key is not found", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const result = await getApiKeyWithPermissions("invalid-key");

    expect(result).toBeNull();
  });
});

describe("hasPermission", () => {
  const permissions: TAPIKeyEnvironmentPermission[] = [
    {
      environmentId: "env-1",
      permission: "manage",
      environmentType: "development",
      projectId: "project-1",
      projectName: "Project 1",
    },
    {
      environmentId: "env-2",
      permission: "write",
      environmentType: "production",
      projectId: "project-2",
      projectName: "Project 2",
    },
    {
      environmentId: "env-3",
      permission: "read",
      environmentType: "development",
      projectId: "project-3",
      projectName: "Project 3",
    },
  ];

  test("returns true for manage permission with any method", () => {
    expect(hasPermission(permissions, "env-1", "GET")).toBe(true);
    expect(hasPermission(permissions, "env-1", "POST")).toBe(true);
    expect(hasPermission(permissions, "env-1", "DELETE")).toBe(true);
  });

  test("handles write permission correctly", () => {
    expect(hasPermission(permissions, "env-2", "GET")).toBe(true);
    expect(hasPermission(permissions, "env-2", "POST")).toBe(true);
    expect(hasPermission(permissions, "env-2", "DELETE")).toBe(false);
  });

  test("handles read permission correctly", () => {
    expect(hasPermission(permissions, "env-3", "GET")).toBe(true);
    expect(hasPermission(permissions, "env-3", "POST")).toBe(false);
    expect(hasPermission(permissions, "env-3", "DELETE")).toBe(false);
  });

  test("returns false for non-existent environment", () => {
    expect(hasPermission(permissions, "env-4", "GET")).toBe(false);
  });
});

describe("authenticateRequest", () => {
  test("should return authentication data for valid API key", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      hashedKey: "hashed-key",
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Test API Key",
      apiKeyEnvironments: [
        {
          environmentId: "env-1",
          permission: "manage" as const,
          environment: {
            id: "env-1",
            projectId: "project-1",
            project: { name: "Project 1" },
            type: "development",
          },
        },
      ],
    };

    vi.mocked(hashApiKey).mockReturnValue("hashed-key");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKeyData);
    vi.mocked(prisma.apiKey.update).mockResolvedValue(mockApiKeyData);

    const result = await authenticateRequest(request);

    expect(result).toEqual({
      type: "apiKey",
      environmentPermissions: [
        {
          environmentId: "env-1",
          permission: "manage",
          environmentType: "development",
          projectId: "project-1",
          projectName: "Project 1",
        },
      ],
      hashedApiKey: "hashed-key",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
    });
  });

  test("returns null when no API key is provided", async () => {
    const request = new Request("http://localhost");
    const result = await authenticateRequest(request);
    expect(result).toBeNull();
  });

  test("returns null when API key is invalid", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "invalid-api-key" },
    });

    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const result = await authenticateRequest(request);
    expect(result).toBeNull();
  });
});
