import { ApiKeyPermission, EnvironmentType } from "@prisma/client";
import { describe, expect, test } from "vitest";
import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { hasProjectPermission } from "../utils";

const makePermission = (
  projectId: string,
  environmentId: string,
  permission: ApiKeyPermission
): TAPIKeyEnvironmentPermission => ({
  projectId,
  environmentId,
  environmentType: "production" as EnvironmentType,
  projectName: "Test Project",
  permission,
});

describe("hasProjectPermission", () => {
  const permissions: TAPIKeyEnvironmentPermission[] = [
    makePermission("project1", "env1", "manage"),
    makePermission("project2", "env2", "read"),
  ];

  test("returns true for GET on project with manage permission", () => {
    expect(hasProjectPermission(permissions, "project1", "GET")).toBe(true);
  });

  test("returns true for DELETE on project with manage permission", () => {
    expect(hasProjectPermission(permissions, "project1", "DELETE")).toBe(true);
  });

  test("returns true for GET on project with read permission", () => {
    expect(hasProjectPermission(permissions, "project2", "GET")).toBe(true);
  });

  test("returns false for POST on project with read permission", () => {
    expect(hasProjectPermission(permissions, "project2", "POST")).toBe(false);
  });

  test("returns false for DELETE on project with read permission", () => {
    expect(hasProjectPermission(permissions, "project2", "DELETE")).toBe(false);
  });

  test("returns false for unknown project", () => {
    expect(hasProjectPermission(permissions, "unknown-project", "GET")).toBe(false);
  });

  test("returns false for empty permissions array", () => {
    expect(hasProjectPermission([], "project1", "GET")).toBe(false);
  });
});
