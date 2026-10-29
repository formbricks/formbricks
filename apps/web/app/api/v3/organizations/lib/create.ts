import "server-only";
import { logger } from "@formbricks/logger";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { parseV3Body } from "@/app/api/v3/lib/parse-body";
import { createdResponse, problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getSetupGuideUrl } from "@/modules/agent-setup/urls";
import { createOwnedOrganization } from "@/modules/auth/lib/owned-organization";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationCreationPolicy } from "./creation-policy";
import { type TV3OrganizationCreatedResource, ZV3OrganizationCreateBody } from "./schemas";

export const ORGANIZATION_CREATE_SIGNED_IN_MESSAGE =
  "Only a signed-in person can create an organization. API keys cannot.";
export const MULTI_ORG_DISABLED_MESSAGE =
  "This instance is limited to one organization. Multiple organizations need the multi-organization licence.";

type TCreateOrganizationParams = {
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Create an organization the signed-in person owns (ADR 0018). Used by the `create_organization` tool, the
 * `POST /api/v3/organizations` route and the organization switcher, so all three answer the same.
 *
 * Allowed on a fresh instance (the first organization) or when the multi-organization licence is on, the
 * rule the retired create-organization form enforced. It creates no workspace: the result points the agent
 * at the Setup guide's new-owner path, which creates the first one. Rate limited per user, because every
 * organization starts with fresh per-organization budgets.
 */
export async function createV3Organization({
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TCreateOrganizationParams): Promise<Response> {
  const log = logger.withContext({ requestId });

  try {
    if (!authentication) {
      return problemUnauthorized(requestId, "Not authenticated", instance);
    }

    if (!("user" in authentication) || !authentication.user?.id) {
      return problemForbidden(requestId, ORGANIZATION_CREATE_SIGNED_IN_MESSAGE, instance);
    }
    const { user } = authentication;

    const parsed = parseV3Body(ZV3OrganizationCreateBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;

    const { allowed, hasNoOrganizations } = await getOrganizationCreationPolicy();
    if (!allowed) {
      log.warn({ statusCode: 403 }, "Organization create refused: multi-organization is not enabled");
      return problemForbidden(requestId, MULTI_ORG_DISABLED_MESSAGE, instance);
    }

    await applyRateLimit(rateLimitConfigs.actions.createOrganization, user.id);

    // A session user carries no notification settings, so there is nothing to switch off here: that is a
    // self sign-up default, not something an existing person asked for by creating a second organization.
    const organization = await createOwnedOrganization(user, {
      name: parsed.data.name,
      isFirstOrganization: hasNoOrganizations,
      unsubscribeFromNotifications: false,
    });

    if (auditLog) {
      auditLog.organizationId = organization.id;
      auditLog.targetId = organization.id;
      auditLog.newObject = { id: organization.id, name: organization.name };
    }

    const resource: TV3OrganizationCreatedResource = {
      id: organization.id,
      name: organization.name,
      role: "owner",
      workspaceCount: 0,
      setupGuideUrl: getSetupGuideUrl(),
      nextStep:
        "The organization has no workspace yet. Follow the Setup guide's new-owner path (Path A) for this organization: interview the person, then create the first workspace.",
    };

    log.info({ statusCode: 201 }, "Organization created");
    return createdResponse(resource, {
      requestId,
      location: `/api/v3/organizations/${organization.id}`,
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "organizations.create" });
  }
}
