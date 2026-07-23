import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { TAPIKeyWorkspacePermission } from "@formbricks/types/auth";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UniqueConstraintError,
} from "@formbricks/types/errors";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { authenticateRequest, handleErrorResponse } from "./auth";

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
          workspace: { id: "workspace-1", name: "Workspace 1", organizationId: "org-id" },
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
          workspace: { id: "workspace-1", name: "Workspace 1", organizationId: "org-id" },
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
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);

    const result = await authenticateRequest(request, { allowOrganizationOnlyApiKey: true });
    expect(result).toEqual({
      type: "apiKey",
      workspacePermissions: [],
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
    } as any);

    const result = await authenticateRequest(request, { allowOrganizationOnlyApiKey: true });

    expect(result).toEqual({
      type: "apiKey",
      workspacePermissions: [],
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all",
    });
    expect(getApiKeyWithPermissions).toHaveBeenCalledWith("fbk_valid_bearer_key");
  });

  test("authenticates a valid API key with no environment permissions when explicitly allowed", async () => {
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
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);

    const result = await authenticateRequest(request, { allowOrganizationOnlyApiKey: true });
    expect(result).toEqual({
      type: "apiKey",
      workspacePermissions: [],
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: "all",
    });
  });

  test("authenticates a read-only organization API key with no environment permissions", async () => {
    const request = new NextRequest("http://localhost/api/v1/management/surveys", {
      headers: { "x-api-key": "read-only-org-api-key" },
    });

    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Read-only Organization API Key",
      apiKeyWorkspaces: [],
    };

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData as any);

    const result = await authenticateRequest(request, { allowOrganizationOnlyApiKey: true });
    expect(result).toEqual({
      type: "apiKey",
      workspacePermissions: [],
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });
  });
});

describe("handleErrorResponse", () => {
  test("returns 401 notAuthenticated for 'NotAuthenticated' message", async () => {
    const response = handleErrorResponse(new Error("NotAuthenticated"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("not_authenticated");
  });

  test("returns 401 unauthorized for 'Unauthorized' message", async () => {
    const response = handleErrorResponse(new Error("Unauthorized"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("unauthorized");
  });

  test("returns 409 conflict for UniqueConstraintError", async () => {
    const response = handleErrorResponse(new UniqueConstraintError("Action with name foo already exists"));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("conflict");
    expect(body.message).toBe("Action with name foo already exists");
  });

  test("returns a generic 500 for DatabaseError without leaking the message", async () => {
    const response = handleErrorResponse(new DatabaseError("db boom"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe("Something went wrong. Please try again.");
    expect(JSON.stringify(body)).not.toContain("db boom");
  });

  test("returns 400 badRequest for InvalidInputError", async () => {
    const response = handleErrorResponse(new InvalidInputError("bad input"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toBe("bad input");
  });

  test("returns 404 notFound for ResourceNotFoundError", async () => {
    const response = handleErrorResponse(new ResourceNotFoundError("Survey", "id-1"));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      code: "not_found",
      message: "Survey not found",
      details: {
        resource_id: "id-1",
        resource_type: "Survey",
      },
    });
  });

  test("returns a generic 500 for unknown errors", async () => {
    const response = handleErrorResponse(new Error("something else"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe("Something went wrong. Please try again.");
  });
});
