import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  createdResponse,
  problemBadRequest,
  problemForbidden,
  problemUnauthorized,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, getEmailDomain, groupIdentifyPostHog } from "@/lib/posthog";
import { getSetupGuideUrl } from "@/modules/agent-setup/urls";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
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

    const parsed = ZV3OrganizationCreateBody.safeParse(body);
    if (!parsed.success) {
      return problemBadRequest(requestId, "Invalid request body", {
        invalid_params: formatZodIssues(parsed.error, "body"),
        instance,
      });
    }

    const { allowed, hasNoOrganizations } = await getOrganizationCreationPolicy();
    if (!allowed) {
      log.warn({ statusCode: 403 }, "Organization create refused: multi-organization is not enabled");
      return problemForbidden(requestId, MULTI_ORG_DISABLED_MESSAGE, instance);
    }

    await applyRateLimit(rateLimitConfigs.actions.createOrganization, user.id);

    const organization = await createOrganization({ name: parsed.data.name });
    try {
      await createMembership(organization.id, user.id, { role: "owner", accepted: true });
    } catch (error) {
      // The two writes are separate services, so an organization with no owner would be left behind
      // and nobody could ever reach it. It was created a moment ago and owns nothing, so removing it
      // is safe; the original failure is what the caller sees.
      await prisma.organization.delete({ where: { id: organization.id } }).catch((cleanupError) => {
        log.error(
          { error: cleanupError, organizationId: organization.id },
          "Could not remove the ownerless organization after its membership failed"
        );
      });
      throw error;
    }

    if (auditLog) {
      auditLog.organizationId = organization.id;
      auditLog.targetId = organization.id;
      auditLog.newObject = { id: organization.id, name: organization.name };
    }

    // Stripe setup must run AFTER membership is created so the owner email is available.
    if (IS_FORMBRICKS_CLOUD) {
      ensureCloudStripeSetupForOrganization(organization.id).catch((error) => {
        logger.error(
          { error, organizationId: organization.id },
          "Stripe setup failed after organization creation"
        );
      });
    }

    groupIdentifyPostHog("organization", organization.id, {
      name: organization.name,
      email_domain: user.email ? getEmailDomain(user.email) : undefined,
    });
    capturePostHogEvent(
      user.id,
      "organization_created",
      { organization_id: organization.id, is_first_org: hasNoOrganizations },
      { organizationId: organization.id }
    );

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
