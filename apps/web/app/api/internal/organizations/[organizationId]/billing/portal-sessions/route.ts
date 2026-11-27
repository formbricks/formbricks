import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { createBillingPortalSessionOperation } from "../lib/checkout-operations";

/** `POST /api/internal/organizations/{organizationId}/billing/portal-sessions`: a Stripe customer portal session for the billing page. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createBillingPortalSessionOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
