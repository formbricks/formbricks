import { EnvironmentType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getEnvironment } from "@/lib/environment/service";
import { buildApiKeyMeResponse } from "./api-key-response";

vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));

const baseAuthentication = {
  type: "apiKey" as const,
  apiKeyId: "api-key-id",
  organizationId: "org-id",
  organizationAccess: {
    accessControl: {
      read: false,
      write: false,
    },
  },
  environmentPermissions: [],
};

const environmentPermission = (
  environmentId: string,
  permission: "read" | "write" | "manage" = "read"
): TAuthenticationApiKey["environmentPermissions"][number] => ({
  environmentId,
  permission,
  environmentType: EnvironmentType.development,
  projectId: "project-id",
  projectName: "Project Name",
});

describe("buildApiKeyMeResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns auth metadata for an organization-read API key without environment permissions", async () => {
    const response = await buildApiKeyMeResponse({
      ...baseAuthentication,
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      environmentPermissions: [],
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });
    expect(getEnvironment).not.toHaveBeenCalled();
  });

  test("returns auth metadata with permissions for organization-read API keys with multiple environments", async () => {
    const response = await buildApiKeyMeResponse({
      ...baseAuthentication,
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
      environmentPermissions: [
        environmentPermission("env-1", "read"),
        environmentPermission("env-2", "write"),
      ],
    });

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      environmentPermissions: [
        {
          environmentId: "env-1",
          environmentType: EnvironmentType.development,
          permissions: "read",
          projectId: "project-id",
          projectName: "Project Name",
        },
        {
          environmentId: "env-2",
          environmentType: EnvironmentType.development,
          permissions: "write",
          projectId: "project-id",
          projectName: "Project Name",
        },
      ],
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });
    expect(getEnvironment).not.toHaveBeenCalled();
  });

  test("returns the legacy environment response for a single environment permission", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");

    vi.mocked(getEnvironment).mockResolvedValue({
      id: "env-id",
      type: EnvironmentType.development,
      createdAt,
      updatedAt,
      projectId: "project-id",
      appSetupCompleted: true,
    });

    const response = await buildApiKeyMeResponse({
      ...baseAuthentication,
      environmentPermissions: [environmentPermission("env-id", "read")],
    });

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      id: "env-id",
      type: EnvironmentType.development,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      appSetupCompleted: true,
      project: {
        id: "project-id",
        name: "Project Name",
      },
    });
    expect(getEnvironment).toHaveBeenCalledWith("env-id");
  });

  test("returns the legacy environment response for an organization-read API key with one environment", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");

    vi.mocked(getEnvironment).mockResolvedValue({
      id: "env-id",
      type: EnvironmentType.development,
      createdAt,
      updatedAt,
      projectId: "project-id",
      appSetupCompleted: true,
    });

    const response = await buildApiKeyMeResponse({
      ...baseAuthentication,
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
      environmentPermissions: [environmentPermission("env-id", "read")],
    });

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      id: "env-id",
      type: EnvironmentType.development,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      appSetupCompleted: true,
      project: {
        id: "project-id",
        name: "Project Name",
      },
    });
    expect(getEnvironment).toHaveBeenCalledWith("env-id");
  });

  test("returns null when an API key has neither organization read nor exactly one environment", async () => {
    const response = await buildApiKeyMeResponse(baseAuthentication);

    expect(response).toBeNull();
    expect(getEnvironment).not.toHaveBeenCalled();
  });

  test("returns null when the single permitted environment no longer exists", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(null);

    const response = await buildApiKeyMeResponse({
      ...baseAuthentication,
      environmentPermissions: [environmentPermission("env-id", "read")],
    });

    expect(response).toBeNull();
    expect(getEnvironment).toHaveBeenCalledWith("env-id");
  });
});
