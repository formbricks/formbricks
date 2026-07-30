import "server-only";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import type { TAPIKeyWorkspacePermission, TAuthenticationApiKey } from "@formbricks/types/auth";

/**
 * The current API-key permission ladders, kept as pure functions.
 *
 * These are intentionally internal to the legacy evaluator. Public callers must use
 * the central authorization interface (directly, or through the temporary
 * compatibility wrappers in `@/modules/organization/settings/api-keys/lib/utils`).
 * Keeping the ladder here is what lets those wrappers delegate to `can` without
 * recursing back into the evaluator.
 */

export type LegacyApiKeyMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiKeyPermissionLevel = "read" | "write" | "manage";

/** Permission level each HTTP method requires (GET reads, writes mutate, DELETE manages). */
const METHOD_REQUIRED_PERMISSION: Record<LegacyApiKeyMethod, ApiKeyPermissionLevel> = {
  GET: "read",
  POST: "write",
  PUT: "write",
  PATCH: "write",
  DELETE: "manage",
};

/**
 * Whether an API key's stored workspace grant satisfies the level the method needs.
 * `manage` covers everything, `write` covers write and read, `read` covers read only.
 */
export const hasApiKeyWorkspacePermissionLegacy = (
  permissions: TAPIKeyWorkspacePermission[],
  workspaceId: string,
  method: LegacyApiKeyMethod
): boolean => {
  if (!permissions) return false;

  const workspacePermission = permissions.find((permission) => permission.workspaceId === workspaceId);
  if (!workspacePermission) return false;

  const requiredPermission = METHOD_REQUIRED_PERMISSION[method];

  switch (workspacePermission.permission) {
    case "manage":
      return true;
    case "write":
      return requiredPermission === "write" || requiredPermission === "read";
    case "read":
      return requiredPermission === "read";
    default:
      return false;
  }
};

/**
 * Whether an API key holds organization-level access-control rights.
 * `write` implies `read`, mirroring the current behavior.
 */
export const hasApiKeyOrganizationAccessLegacy = (
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): boolean => {
  const organizationAccess = authentication.organizationAccess?.accessControl;

  switch (accessType) {
    case OrganizationAccessType.Read:
      return organizationAccess?.read === true || organizationAccess?.write === true;
    case OrganizationAccessType.Write:
      return organizationAccess?.write === true;
    default:
      return false;
  }
};
