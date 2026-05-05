import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { TAPIKeyWorkspacePermission } from "@formbricks/types/auth";
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
      apiKeyWorkspaces: [
        {
          workspaceId: "workspace-1",
          permission: "manage" as const,
          workspace: { id: "workspace-1", name: "Workspace 1" },
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
  const permissions: TAPIKeyWorkspacePermission[] = [
    {
      permission: "manage",
      workspaceId: "workspace-1",
      workspaceName: "Workspace 1",
    },
    {
      permission: "write",
      workspaceId: "workspace-2",
      workspaceName: "Workspace 2",
    },
    {
      permission: "read",
      workspaceId: "workspace-3",
      workspaceName: "Workspace 3",
    },
  ];

  test("returns true for manage permission with any method", () => {
    expect(hasPermission(permissions, "workspace-1", "GET")).toBe(true);
    expect(hasPermission(permissions, "workspace-1", "POST")).toBe(true);
    expect(hasPermission(permissions, "workspace-1", "DELETE")).toBe(true);
  });

  test("handles write permission correctly", () => {
    expect(hasPermission(permissions, "workspace-2", "GET")).toBe(true);
    expect(hasPermission(permissions, "workspace-2", "POST")).toBe(true);
    expect(hasPermission(permissions, "workspace-2", "DELETE")).toBe(false);
  });

  test("handles read permission correctly", () => {
    expect(hasPermission(permissions, "workspace-3", "GET")).toBe(true);
    expect(hasPermission(permissions, "workspace-3", "POST")).toBe(false);
    expect(hasPermission(permissions, "workspace-3", "DELETE")).toBe(false);
  });

  test("returns false for non-existent workspace", () => {
    expect(hasPermission(permissions, "workspace-4", "GET")).toBe(false);
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
      apiKeyWorkspaces: [
        {
          workspaceId: "workspace-1",
          permission: "manage" as const,
          workspace: { id: "workspace-1", name: "Workspace 1" },
        },
      ],
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);
    const result = await authenticateRequest(request);

    expect(result).toEqual({
      type: "apiKey",
      workspacePermissions: [
        {
          permission: "manage",
          workspaceId: "workspace-1",
          workspaceName: "Workspace 1",
        },
      ],
      feedbackDirectoryPermissions: [],
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

  test("returns authentication data when API key has no workspace permissions", async () => {
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
      apiKeyWorkspaces: [],
      apiKeyFeedbackDirectories: [],
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);

    const result = await authenticateRequest(request);
    expect(result).toEqual({
      type: "apiKey",
      workspacePermissions: [],
      feedbackDirectoryPermissions: [],
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all",
    });
  });

  test("returns authentication data for bearer API keys", async () => {
    const request = new NextRequest("http://localhost", {
      headers: { authorization: "Bearer fbk_valid_bearer_key" },
    });

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue({
      id: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all" as const,
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Test API Key",
      apiKeyWorkspaces: [],
      apiKeyFeedbackDirectories: [
        {
          feedbackDirectoryId: "clxx1234567890123456789012",
          permission: "write" as const,
          feedbackDirectory: {
            id: "clxx1234567890123456789012",
            name: "Directory 1",
          },
        },
      ],
    } as any);

    const result = await authenticateRequest(request);

    expect(result).toEqual({
      type: "apiKey",
      workspacePermissions: [],
      feedbackDirectoryPermissions: [
        {
          feedbackDirectoryId: "clxx1234567890123456789012",
          feedbackDirectoryName: "Directory 1",
          permission: "write",
        },
      ],
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all",
    });
    expect(getApiKeyWithPermissions).toHaveBeenCalledWith("fbk_valid_bearer_key");
  });
});
