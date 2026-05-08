import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getEnvironmentIdsByOrganizationId } from "@/lib/environment/organization";
import { getReadableEnvironmentIds } from "./access";

vi.mock("@/lib/environment/organization", () => ({
  getEnvironmentIdsByOrganizationId: vi.fn(),
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
  permission: "read" | "write" | "manage"
): TAuthenticationApiKey["environmentPermissions"][number] => ({
  environmentId,
  permission,
  environmentType: "development",
  projectId: `project-${environmentId}`,
  projectName: `Project ${environmentId}`,
});

describe("getReadableEnvironmentIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns all organization environments when API key has organization read access", async () => {
    vi.mocked(getEnvironmentIdsByOrganizationId).mockResolvedValue(["env-1", "env-2"]);

    const result = await getReadableEnvironmentIds({
      ...baseAuthentication,
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });

    expect(result).toEqual(["env-1", "env-2"]);
    expect(getEnvironmentIdsByOrganizationId).toHaveBeenCalledWith("org-id");
  });

  test("returns an empty list when an organization-read API key belongs to an organization without environments", async () => {
    vi.mocked(getEnvironmentIdsByOrganizationId).mockResolvedValue([]);

    const result = await getReadableEnvironmentIds({
      ...baseAuthentication,
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });

    expect(result).toEqual([]);
    expect(getEnvironmentIdsByOrganizationId).toHaveBeenCalledWith("org-id");
  });

  test("returns all organization environments when API key has organization write access", async () => {
    vi.mocked(getEnvironmentIdsByOrganizationId).mockResolvedValue(["env-1"]);

    const result = await getReadableEnvironmentIds({
      ...baseAuthentication,
      organizationAccess: {
        accessControl: {
          read: false,
          write: true,
        },
      },
    });

    expect(result).toEqual(["env-1"]);
    expect(getEnvironmentIdsByOrganizationId).toHaveBeenCalledWith("org-id");
  });

  test("returns de-duplicated environment permissions that allow GET without organization access", async () => {
    const result = await getReadableEnvironmentIds({
      ...baseAuthentication,
      environmentPermissions: [
        environmentPermission("env-1", "read"),
        environmentPermission("env-2", "write"),
        environmentPermission("env-3", "manage"),
        environmentPermission("env-1", "read"),
      ],
    });

    expect(result).toEqual(["env-1", "env-2", "env-3"]);
    expect(getEnvironmentIdsByOrganizationId).not.toHaveBeenCalled();
  });

  test("returns null when the API key has no readable access", async () => {
    const result = await getReadableEnvironmentIds(baseAuthentication);

    expect(result).toBeNull();
    expect(getEnvironmentIdsByOrganizationId).not.toHaveBeenCalled();
  });
});
