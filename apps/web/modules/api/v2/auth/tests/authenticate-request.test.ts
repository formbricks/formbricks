import { beforeEach, describe, expect, test, vi } from "vitest";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { TApiKeyWithEnvironmentAndWorkspace } from "@/modules/organization/settings/api-keys/types/api-keys";
import { authenticateRequest } from "../authenticate-request";

// Mock the getApiKeyWithPermissions function
vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeyWithPermissions: vi.fn(),
}));

describe("authenticateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return authentication data if apiKey is valid with workspace permissions", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "fbk_validApiKeySecret123" },
    });

    const mockApiKeyData = {
      id: "api-key-id",
      organizationId: "org-id",
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Test API Key",
      hashedKey: "hashed-key",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
      apiKeyEnvironments: [
        {
          workspaceId: "workspace-id-1",
          permission: "manage",
          apiKeyId: "api-key-id",
          workspace: {
            id: "workspace-id-1",
            name: "Workspace 1",
          },
        },
        {
          workspaceId: "workspace-id-2",
          permission: "read",
          apiKeyId: "api-key-id",
          workspace: {
            id: "workspace-id-2",
            name: "Workspace 2",
          },
        },
      ],
    } as unknown as TApiKeyWithEnvironmentAndWorkspace;

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData);

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        type: "apiKey",
        workspacePermissions: [
          {
            permission: "manage",
            workspaceId: "workspace-id-1",
            workspaceName: "Workspace 1",
          },
          {
            permission: "read",
            workspaceId: "workspace-id-2",
            workspaceName: "Workspace 2",
          },
        ],
        apiKeyId: "api-key-id",
        organizationId: "org-id",
        organizationAccess: {
          accessControl: {
            read: true,
            write: false,
          },
        },
      });
    }

    expect(getApiKeyWithPermissions).toHaveBeenCalledWith("fbk_validApiKeySecret123");
  });

  test("should return authentication data if apiKey is valid with organization-level access only", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "fbk_orgLevelApiKey456" },
    });

    const mockApiKeyData = {
      id: "org-api-key-id",
      organizationId: "org-id",
      createdAt: new Date(),
      createdBy: "user-id",
      lastUsedAt: null,
      label: "Organization Level API Key",
      hashedKey: "hashed-key-org",
      organizationAccess: {
        accessControl: {
          read: true,
          write: true,
        },
      },
      apiKeyEnvironments: [], // No workspace-specific permissions
    } as unknown as TApiKeyWithEnvironmentAndWorkspace;

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData);

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        type: "apiKey",
        workspacePermissions: [],
        apiKeyId: "org-api-key-id",
        organizationId: "org-id",
        organizationAccess: {
          accessControl: {
            read: true,
            write: true,
          },
        },
      });
    }

    expect(getApiKeyWithPermissions).toHaveBeenCalledWith("fbk_orgLevelApiKey456");
  });

  test("should return unauthorized error if apiKey is not found", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "fbk_invalidApiKeySecret" },
    });
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(null);

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }

    expect(getApiKeyWithPermissions).toHaveBeenCalledWith("fbk_invalidApiKeySecret");
  });

  test("should return unauthorized error if apiKey is missing from headers", async () => {
    const request = new Request("http://localhost");

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }

    // Should not call getApiKeyWithPermissions if header is missing
    expect(getApiKeyWithPermissions).not.toHaveBeenCalled();
  });

  test("should return unauthorized error if apiKey header is empty string", async () => {
    const request = new Request("http://localhost", {
      headers: { "x-api-key": "" },
    });

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }

    // Should not call getApiKeyWithPermissions for empty string
    expect(getApiKeyWithPermissions).not.toHaveBeenCalled();
  });
});
