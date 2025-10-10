import { describe, expect, test, vi } from "vitest";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { TApiKeyWithEnvironmentAndProject } from "@/modules/organization/settings/api-keys/types/api-keys";
import { authenticateRequest } from "../authenticate-request";

// Mock the getApiKeyWithPermissions function
vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeyWithPermissions: vi.fn(),
}));

describe("authenticateRequest", () => {
  test("should return authentication data if apiKey is valid with environment permissions", async () => {
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
          environmentId: "env-id-1",
          permission: "manage",
          apiKeyId: "api-key-id",
          environment: {
            id: "env-id-1",
            projectId: "project-id-1",
            type: "development",
            createdAt: new Date(),
            updatedAt: new Date(),
            appSetupCompleted: false,
            project: {
              id: "project-id-1",
              name: "Project 1",
            },
          },
        },
        {
          environmentId: "env-id-2",
          permission: "read",
          apiKeyId: "api-key-id",
          environment: {
            id: "env-id-2",
            projectId: "project-id-2",
            type: "production",
            createdAt: new Date(),
            updatedAt: new Date(),
            appSetupCompleted: false,
            project: {
              id: "project-id-2",
              name: "Project 2",
            },
          },
        },
      ],
    } as unknown as TApiKeyWithEnvironmentAndProject;

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData);

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
      apiKeyEnvironments: [], // No environment-specific permissions
    } as unknown as TApiKeyWithEnvironmentAndProject;

    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(mockApiKeyData);

    const result = await authenticateRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        type: "apiKey",
        environmentPermissions: [],
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
