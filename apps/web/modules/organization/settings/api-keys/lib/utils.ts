import "server-only";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { can } from "@/lib/authorization";
import type { LegacyApiKeyMethod } from "@/lib/authorization/legacy-api-key-access";

/**
 * Compatibility wrappers that route API-key authorization through the central
 * Formbricks authorization interface.
 *
 * These replaced the former synchronous `hasPermission` / `hasOrganizationAccess`
 * helpers. They were renamed rather than made async in place on purpose: a boolean
 * guard such as `if (!hasPermission(...))` keeps compiling when the `await` is
 * forgotten, and `!Promise` is always false — which would silently authorize.
 * Renaming turns every unmigrated call site into a compile error instead.
 *
 * Note that only the identifiers on `authentication` (`apiKeyId`, and the owning
 * `organizationId`) are read. The key's effective scopes are resolved from storage
 * on each decision rather than taken from the passed-in snapshot, so a key that has
 * been revoked, deleted or narrowed since it authenticated stops authorizing.
 */

export type { LegacyApiKeyMethod } from "@/lib/authorization/legacy-api-key-access";

/** HTTP method → workspace action, preserving the current API-key ladder. */
const METHOD_WORKSPACE_ACTION = {
  GET: "workspace.read",
  POST: "workspace.write",
  PUT: "workspace.write",
  PATCH: "workspace.write",
  DELETE: "workspace.manage",
} as const satisfies Record<LegacyApiKeyMethod, "workspace.read" | "workspace.write" | "workspace.manage">;

/**
 * Whether an API key may act on `workspaceId` at the level `method` requires.
 *
 * Compatibility surface only: new authorization-sensitive code must call `can` or
 * `assertCan` with a semantic action and resource instead of adding callers here.
 * The remaining callers are removed under ENG-1737.
 */
export const hasApiKeyWorkspaceAccess = async (
  authentication: TAuthenticationApiKey,
  workspaceId: string,
  method: LegacyApiKeyMethod
): Promise<boolean> =>
  can({ type: "apiKey", id: authentication.apiKeyId }, METHOD_WORKSPACE_ACTION[method], {
    type: "workspace",
    id: workspaceId,
  });

/**
 * Whether an API key holds organization access-control rights. `Write` maps to the
 * access-management action, `Read` to the access-read action, matching the current
 * `accessControl.read` / `accessControl.write` behavior (write implies read).
 *
 * Compatibility surface only: new authorization-sensitive code must call `can` or
 * `assertCan` with a semantic action and resource instead of adding callers here.
 * The remaining callers are removed under ENG-1737.
 */
export const hasApiKeyOrganizationAccess = async (
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): Promise<boolean> =>
  can(
    { type: "apiKey", id: authentication.apiKeyId },
    accessType === OrganizationAccessType.Write ? "organization.manage_access" : "organization.read_access",
    { type: "organization", id: authentication.organizationId }
  );
