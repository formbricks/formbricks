import { describe, expect, test } from "vitest";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import type { TAPIKeyWorkspacePermission, TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  hasApiKeyOrganizationAccessLegacy,
  hasApiKeyWorkspacePermissionLegacy,
} from "./legacy-api-key-access";

const permissions: TAPIKeyWorkspacePermission[] = [
  { permission: "manage", workspaceId: "ws-manage", workspaceName: "Manage" },
  { permission: "write", workspaceId: "ws-write", workspaceName: "Write" },
  { permission: "read", workspaceId: "ws-read", workspaceName: "Read" },
];

const apiKeyAuth = (accessControl: { read?: boolean; write?: boolean } | undefined): TAuthenticationApiKey =>
  ({
    type: "apiKey",
    apiKeyId: "key-1",
    organizationId: "org-1",
    organizationAccess: accessControl ? { accessControl } : undefined,
    workspacePermissions: permissions,
  }) as TAuthenticationApiKey;

describe("hasApiKeyWorkspacePermissionLegacy", () => {
  test("manage grants every method", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-manage", method)).toBe(true);
    }
  });

  test("write grants reads and writes but not delete", () => {
    expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-write", "GET")).toBe(true);
    expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-write", "POST")).toBe(true);
    expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-write", "PUT")).toBe(true);
    expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-write", "PATCH")).toBe(true);
    expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-write", "DELETE")).toBe(false);
  });

  test("read grants only GET", () => {
    expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-read", "GET")).toBe(true);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-read", method)).toBe(false);
    }
  });

  test("denies a workspace the key has no grant on", () => {
    expect(hasApiKeyWorkspacePermissionLegacy(permissions, "ws-none", "GET")).toBe(false);
  });

  test("denies when the key holds no grants at all", () => {
    expect(hasApiKeyWorkspacePermissionLegacy([], "ws-manage", "GET")).toBe(false);
    expect(
      hasApiKeyWorkspacePermissionLegacy(
        undefined as unknown as TAPIKeyWorkspacePermission[],
        "ws-manage",
        "GET"
      )
    ).toBe(false);
  });

  test("denies an unrecognized stored permission value", () => {
    const rogue = [
      { permission: "superuser", workspaceId: "ws-x", workspaceName: "X" },
    ] as unknown as TAPIKeyWorkspacePermission[];
    expect(hasApiKeyWorkspacePermissionLegacy(rogue, "ws-x", "GET")).toBe(false);
  });
});

describe("hasApiKeyOrganizationAccessLegacy", () => {
  test("read access grants Read only", () => {
    const auth = apiKeyAuth({ read: true, write: false });
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Read)).toBe(true);
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Write)).toBe(false);
  });

  test("write access implies read", () => {
    const auth = apiKeyAuth({ read: false, write: true });
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Read)).toBe(true);
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Write)).toBe(true);
  });

  test("denies when the key holds neither right", () => {
    const auth = apiKeyAuth({ read: false, write: false });
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Read)).toBe(false);
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Write)).toBe(false);
  });

  test("denies when organization access is absent", () => {
    const auth = apiKeyAuth(undefined);
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Read)).toBe(false);
    expect(hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Write)).toBe(false);
  });
});
