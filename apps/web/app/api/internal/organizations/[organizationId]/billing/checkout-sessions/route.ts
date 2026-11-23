import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { createBillingCheckoutSessionOperation } from "../lib/checkout-operations";
import { ZBillingCheckoutSessionBody } from "../schemas";

/** `POST /api/internal/organizations/{organizationId}/billing/checkout-sessions`: a Checkout Session buying a paid plan. Takes an `Idempotency-Key`. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZBillingCheckoutSessionBody },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ req, authentication, parsedInput, requestId, instance, auditLog }) =>
    createBillingCheckoutSessionOperation({
      req,
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
      body: parsedInput.body,
    }),
});
