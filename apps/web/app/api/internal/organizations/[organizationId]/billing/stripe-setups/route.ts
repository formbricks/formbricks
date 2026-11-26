import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { retryStripeSetupOperation } from "../lib/plan-operations";

/** `POST /api/internal/organizations/{organizationId}/billing/stripe-setups`: provision the organization's Stripe customer and Hobby subscription again. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    retryStripeSetupOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
