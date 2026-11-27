import "server-only";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { type TAuthorizationAction, type TAuthorizationActor, can } from "@/lib/authorization";
import { problemForbidden, problemUnauthorized } from "./response";
import type { TV3Authentication } from "./types";

/**
 * Organization-scoped v3 access (`/api/v3/organizations/{organizationId}/…`), for the organization's
 * access-control settings: Member attributes today, and the other Dashboard Access Control settings next.
 *
 * - `read`: an Owner or Manager session (`organization.manage`), or an API key of this organization with
 *   Access Control read or write (`organization.read_access`, which admits `api_key_reader` and
 *   `api_key_writer`). Members are not admitted: an attribute key list and everyone's values are
 *   administration data, even though a member's own values are shown to them in the app.
 * - `write`: `organization.manage_access` — Owners and Managers above the user-management floor
 *   (`USER_MANAGEMENT_MINIMUM_ROLE`), or an API key of this organization with Access Control write. The
 *   same decision the member and invite controls ask (`canManageUsers`).
 *
 * An API key of another organization, an unknown organization, or a caller without the permission all
 * answer the same 403, so organization ids cannot be probed.
 */
export type TV3OrganizationAccessLevel = "read" | "write";

export type TV3OrganizationContext = { organizationId: string };

type TOrganizationAction = Extract<TAuthorizationAction, `organization.${string}`>;

const SESSION_ACTIONS: Record<TV3OrganizationAccessLevel, TOrganizationAction> = {
  read: "organization.manage",
  write: "organization.manage_access",
};

const API_KEY_ACTIONS: Record<TV3OrganizationAccessLevel, TOrganizationAction> = {
  read: "organization.read_access",
  write: "organization.manage_access",
};

export async function requireV3OrganizationAccess(
  authentication: TV3Authentication,
  organizationId: string,
  level: TV3OrganizationAccessLevel,
  requestId: string,
  instance?: string
): Promise<Response | TV3OrganizationContext> {
  if (!authentication) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  const log = logger.withContext({ requestId, organizationId });
  const forbidden = () =>
    problemForbidden(requestId, "You are not authorized to access this resource", instance);

  let actor: TAuthorizationActor;
  let action: TOrganizationAction;
  if ("user" in authentication && authentication.user?.id) {
    actor = { type: "user", id: authentication.user.id };
    action = SESSION_ACTIONS[level];
  } else {
    const keyAuth = authentication as TAuthenticationApiKey;
    if (!keyAuth.apiKeyId) return problemUnauthorized(requestId, "Not authenticated", instance);
    // A key belongs to one organization; it never reaches another, whatever SpiceDB holds.
    if (keyAuth.organizationId !== organizationId) {
      log.warn({ statusCode: 403, apiKeyId: keyAuth.apiKeyId }, "API key of another organization");
      return forbidden();
    }
    actor = { type: "apiKey", id: keyAuth.apiKeyId };
    action = API_KEY_ACTIONS[level];
  }

  try {
    const allowed = await can(actor, action, { type: "organization", id: organizationId });
    if (!allowed) {
      log.warn({ statusCode: 403, action }, "Organization access refused");
      return forbidden();
    }
  } catch (error) {
    if (error instanceof ResourceNotFoundError || error instanceof AuthorizationError) {
      log.warn({ statusCode: 403, errorCode: error.name }, "Organization access refused");
      return forbidden();
    }
    throw error;
  }

  return { organizationId };
}
