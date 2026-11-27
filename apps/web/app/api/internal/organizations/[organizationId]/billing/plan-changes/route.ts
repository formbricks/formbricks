import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { changeBillingPlanOperation } from "../lib/plan-operations";
import { ZBillingPlanChangeBody } from "../schemas";

/** `POST /api/internal/organizations/{organizationId}/billing/plan-changes`: switch the organization's plan. Takes an `Idempotency-Key`. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZBillingPlanChangeBody },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ req, authentication, parsedInput, requestId, instance, auditLog }) =>
    changeBillingPlanOperation({
      req,
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
      body: parsedInput.body,
    }),
});
