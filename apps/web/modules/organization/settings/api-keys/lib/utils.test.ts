import { describe, expect, test, vi } from "vitest";
import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { getOrganizationAccessKeyDisplayName, hasPermission } from "./utils";

describe("hasPermission", () => {
  const envId = "env1";
  test("returns true for manage permission (all methods)", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: envId,
        environmentType: "production",
        projectId: "project1",
        projectName: "Project One",
        permission: "manage",
      },
    ];
    expect(hasPermission(permissions, envId, "GET")).toBe(true);
    expect(hasPermission(permissions, envId, "POST")).toBe(true);
    expect(hasPermission(permissions, envId, "PUT")).toBe(true);
    expect(hasPermission(permissions, envId, "PATCH")).toBe(true);
    expect(hasPermission(permissions, envId, "DELETE")).toBe(true);
  });

  test("returns true for write permission (read/write), false for delete", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: envId,
        environmentType: "production",
        projectId: "project1",
        projectName: "Project One",
        permission: "write",
      },
    ];
    expect(hasPermission(permissions, envId, "GET")).toBe(true);
    expect(hasPermission(permissions, envId, "POST")).toBe(true);
    expect(hasPermission(permissions, envId, "PUT")).toBe(true);
    expect(hasPermission(permissions, envId, "PATCH")).toBe(true);
    expect(hasPermission(permissions, envId, "DELETE")).toBe(false);
  });

  test("returns true for read permission (GET), false for others", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: envId,
        environmentType: "production",
        projectId: "project1",
        projectName: "Project One",
        permission: "read",
      },
    ];
    expect(hasPermission(permissions, envId, "GET")).toBe(true);
    expect(hasPermission(permissions, envId, "POST")).toBe(false);
    expect(hasPermission(permissions, envId, "PUT")).toBe(false);
    expect(hasPermission(permissions, envId, "PATCH")).toBe(false);
    expect(hasPermission(permissions, envId, "DELETE")).toBe(false);
  });

  test("returns false if no permissions or environment entry", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "other",
        environmentType: "production",
        projectId: "project1",
        projectName: "Project One",
        permission: "manage",
      },
    ];
    expect(hasPermission(undefined as any, envId, "GET")).toBe(false);
    expect(hasPermission([], envId, "GET")).toBe(false);
    expect(hasPermission(permissions, envId, "GET")).toBe(false);
  });

  test("returns false for unknown permission", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "other",
        environmentType: "production",
        projectId: "project1",
        projectName: "Project One",
        permission: "unknown" as any,
      },
    ];
    expect(hasPermission(permissions, "other", "GET")).toBe(false);
  });
});

describe("getOrganizationAccessKeyDisplayName", () => {
  test("returns tolgee string for accessControl", () => {
    const t = vi.fn((k) => k);
    expect(getOrganizationAccessKeyDisplayName("accessControl", t)).toBe(
      "environments.project.api_keys.access_control"
    );
    expect(t).toHaveBeenCalledWith("environments.project.api_keys.access_control");
  });
  test("returns tolgee string for other keys", () => {
    const t = vi.fn((k) => k);
    expect(getOrganizationAccessKeyDisplayName("otherKey", t)).toBe("otherKey");
    expect(t).toHaveBeenCalledWith("otherKey");
  });
});
