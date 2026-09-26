import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { can } from "@/lib/authorization";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getOrganization } from "@/lib/organization/service";
import { ZUsageRangeQuery, resolveUsageRange } from "@/modules/organization/usage/lib/range";
import { getOrganizationUsage } from "@/modules/organization/usage/lib/usage";

/**
 * `GET /api/organizations/{organizationId}/usage` — the numbers behind the organization Usage page.
 *
 * Internal rather than `/api/v3` (ENG-3328): the only caller is the Usage page, and the response shape is
 * still settling, so it carries no OpenAPI entry and no compatibility promise. Promote it to v3 once
 * someone needs programmatic access. Session-only.
 *
 * Self-hosted only, Owners and Managers only (ENG-3316, ENG-3327). The sidebar hides the tab, but that is
 * cosmetic — this route is the check.
 */

const paramsSchema = z.object({
  organizationId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  action: "queried",
  targetType: "organization",
  schemas: {
    params: paramsSchema,
    query: ZUsageRangeQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const { organizationId } = parsedInput.params;

    if (IS_FORMBRICKS_CLOUD) {
      return problemForbidden(requestId, undefined, instance);
    }

    const userId = authentication && "user" in authentication ? authentication.user?.id : undefined;
    // 403 whether the organization does not exist or the caller may not manage it — a 404 would confirm
    // which organization ids are real.
    const isAllowed =
      !!userId &&
      (await can({ type: "user", id: userId }, "organization.manage", {
        type: "organization",
        id: organizationId,
      }));
    if (!isAllowed) {
      return problemForbidden(requestId, undefined, instance);
    }

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = organizationId;
    }

    // Days are cut in the organization's display time zone (UTC when unset), read from the record — the
    // client never supplies a zone.
    const organization = await getOrganization(organizationId);
    const timeZone = getReportingTimeZone(organization?.displayTimeZone);

    const usage = await getOrganizationUsage({
      organizationId,
      range: resolveUsageRange(parsedInput.query, timeZone),
      timeZone,
    });

    return successResponse(usage, { requestId });
  },
});
