import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { startProTrialOperation } from "../lib/plan-operations";

/** `POST /api/internal/organizations/{organizationId}/billing/pro-trials`: the onboarding "start the free trial" choice. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    startProTrialOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
