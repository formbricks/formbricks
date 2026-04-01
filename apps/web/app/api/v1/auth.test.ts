import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { authenticateRequest } from "./auth";

vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeyWithPermissions: vi.fn(),
}));

describe("getApiKeyWithPermissions", () => {
  test("returns API key data with permissions when valid key is provided", async () => {
    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all" as const,
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
            createdAt: new Date(),
            updatedAt: new Date(),
            type: "development" as const,
            workspaceId: "workspace-1",
            appSetupCompleted: true,
            workspace: { id: "workspace-1", name: "Workspace 1" },
          },
        },
      ],
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);

    const result = await getApiKeyWithPermissions("test-api-key");

    expect(result).toEqual(mockApiKeyData);
    expect(getApiKeyWithPermissions).toHaveBeenCalledWith("test-api-key");
  });

  test("returns null when API key is not found", async () => {
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(null);

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
      workspaceId: "workspace-1",
      workspaceName: "Workspace 1",
    },
    {
      environmentId: "env-2",
      permission: "write",
      environmentType: "production",
      workspaceId: "workspace-2",
      workspaceName: "Workspace 2",
    },
    {
      environmentId: "env-3",
      permission: "read",
      environmentType: "development",
      workspaceId: "workspace-3",
      workspaceName: "Workspace 3",
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
    const request = new NextRequest("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all" as const,
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
            createdAt: new Date(),
            updatedAt: new Date(),
            type: "development" as const,
            workspaceId: "workspace-1",
            appSetupCompleted: true,
            workspace: { id: "workspace-1", name: "Workspace 1" },
          },
        },
      ],
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);
    const result = await authenticateRequest(request);

    expect(result).toEqual({
      type: "apiKey",
      environmentPermissions: [
        {
          environmentId: "env-1",
          permission: "manage",
          environmentType: "development",
          workspaceId: "workspace-1",
          workspaceName: "Workspace 1",
        },
      ],
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all",
    });
    expect(getApiKeyWithPermissions).toHaveBeenCalledWith("valid-api-key");
  });

  test("returns null when no API key is provided", async () => {
    const request = new NextRequest("http://localhost");
    const result = await authenticateRequest(request);
    expect(result).toBeNull();
  });

  test("returns null when API key is invalid", async () => {
    const request = new NextRequest("http://localhost", {
      headers: { "x-api-key": "invalid-api-key" },
    });

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(null);

    const result = await authenticateRequest(request);
    expect(result).toBeNull();
  });

  test("returns null when API key has no environment permissions", async () => {
    const request = new NextRequest("http://localhost", {
      headers: { "x-api-key": "valid-api-key" },
    });

    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all" as const,
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Test API Key",
      apiKeyEnvironments: [],
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);

    const result = await authenticateRequest(request);
    expect(result).toBeNull();
  });
});
