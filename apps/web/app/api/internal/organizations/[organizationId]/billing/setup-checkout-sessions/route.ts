import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { createBillingSetupCheckoutSessionOperation } from "../lib/checkout-operations";
import { ZBillingSetupCheckoutSessionBody } from "../schemas";

/** `POST /api/internal/organizations/{organizationId}/billing/setup-checkout-sessions`: a setup Checkout Session adding a card, optionally upgrading. Takes an `Idempotency-Key`. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams, body: ZBillingSetupCheckoutSessionBody },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ req, authentication, parsedInput, requestId, instance, auditLog }) =>
    createBillingSetupCheckoutSessionOperation({
      req,
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
      body: parsedInput.body,
    }),
});
