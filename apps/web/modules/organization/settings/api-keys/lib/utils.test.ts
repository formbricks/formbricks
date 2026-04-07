import { describe, expect, test } from "vitest";
import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { hasPermission, hasWorkspacePermission } from "./utils";

describe("hasPermission", () => {
  const wsId = "workspace1";
  test("returns true for manage permission (all methods)", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "manage",
      },
    ];
    expect(hasPermission(permissions, wsId, "GET")).toBe(true);
    expect(hasPermission(permissions, wsId, "POST")).toBe(true);
    expect(hasPermission(permissions, wsId, "PUT")).toBe(true);
    expect(hasPermission(permissions, wsId, "PATCH")).toBe(true);
    expect(hasPermission(permissions, wsId, "DELETE")).toBe(true);
  });

  test("returns true for write permission (read/write), false for delete", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "write",
      },
    ];
    expect(hasPermission(permissions, wsId, "GET")).toBe(true);
    expect(hasPermission(permissions, wsId, "POST")).toBe(true);
    expect(hasPermission(permissions, wsId, "PUT")).toBe(true);
    expect(hasPermission(permissions, wsId, "PATCH")).toBe(true);
    expect(hasPermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("returns true for read permission (GET), false for others", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "read",
      },
    ];
    expect(hasPermission(permissions, wsId, "GET")).toBe(true);
    expect(hasPermission(permissions, wsId, "POST")).toBe(false);
    expect(hasPermission(permissions, wsId, "PUT")).toBe(false);
    expect(hasPermission(permissions, wsId, "PATCH")).toBe(false);
    expect(hasPermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("returns false if no permissions or workspace entry", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: "other-workspace",
        workspaceName: "Other",
        permission: "manage",
      },
    ];
    expect(hasPermission(undefined as any, wsId, "GET")).toBe(false);
    expect(hasPermission([], wsId, "GET")).toBe(false);
    expect(hasPermission(permissions, wsId, "GET")).toBe(false);
  });

  test("returns false for unknown permission", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "unknown" as any,
      },
    ];
    expect(hasPermission(permissions, wsId, "GET")).toBe(false);
  });
});

describe("hasWorkspacePermission", () => {
  const wsId = "workspace1";

  test("returns true for manage permission (all methods)", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "manage",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PUT")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PATCH")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(true);
  });

  test("returns true for write permission (read/write), false for delete", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "write",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PUT")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PATCH")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("returns true for read permission (GET only)", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "read",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(false);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("uses only production environment permission, ignores higher dev permission", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "read",
      },
      {
        environmentId: "env2",
        environmentType: "development",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "manage",
      },
    ];
    // Only production permission (read) matters → write/delete should fail
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(false);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("uses production environment permission even when dev has lower", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "manage",
      },
      {
        environmentId: "env2",
        environmentType: "development",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "read",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(true);
  });

  test("returns false if no permissions for the workspace", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: "other-workspace",
        workspaceName: "Other",
        permission: "manage",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(false);
  });

  test("returns false for undefined/empty permissions", () => {
    expect(hasWorkspacePermission(undefined as any, wsId, "GET")).toBe(false);
    expect(hasWorkspacePermission([], wsId, "GET")).toBe(false);
  });

  test("returns false for unknown permission value", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "unknown" as any,
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(false);
  });
});

describe("hasWorkspacePermission", () => {
  const wsId = "workspace1";

  test("returns true for manage permission (all methods)", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "manage",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PUT")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PATCH")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(true);
  });

  test("returns true for write permission (read/write), false for delete", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "write",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PUT")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "PATCH")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("returns true for read permission (GET only)", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "read",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(false);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("uses only production environment permission, ignores higher dev permission", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "read",
      },
      {
        environmentId: "env2",
        environmentType: "development",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "manage",
      },
    ];
    // Only production permission (read) matters → write/delete should fail
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(false);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(false);
  });

  test("uses production environment permission even when dev has lower", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "manage",
      },
      {
        environmentId: "env2",
        environmentType: "development",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "read",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "POST")).toBe(true);
    expect(hasWorkspacePermission(permissions, wsId, "DELETE")).toBe(true);
  });

  test("returns false if no permissions for the workspace", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: "other-workspace",
        workspaceName: "Other",
        permission: "manage",
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(false);
  });

  test("returns false for undefined/empty permissions", () => {
    expect(hasWorkspacePermission(undefined as any, wsId, "GET")).toBe(false);
    expect(hasWorkspacePermission([], wsId, "GET")).toBe(false);
  });

  test("returns false for unknown permission value", () => {
    const permissions: TAPIKeyEnvironmentPermission[] = [
      {
        environmentId: "env1",
        environmentType: "production",
        workspaceId: wsId,
        workspaceName: "Workspace One",
        permission: "unknown" as any,
      },
    ];
    expect(hasWorkspacePermission(permissions, wsId, "GET")).toBe(false);
  });
});
