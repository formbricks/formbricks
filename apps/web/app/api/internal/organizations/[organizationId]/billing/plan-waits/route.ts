import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { waitForBillingPlanOperation } from "../lib/sync-operations";
import { ZBillingPlanWaitBody } from "../schemas";

/** `POST /api/internal/organizations/{organizationId}/billing/plan-waits`: resync until the plan reflects. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZBillingPlanWaitBody },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    waitForBillingPlanOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
      body: parsedInput.body,
    }),
});
