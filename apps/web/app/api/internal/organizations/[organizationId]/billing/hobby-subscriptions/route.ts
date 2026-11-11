import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZOrganizationIdParams } from "../../../schemas";
import { startHobbyPlanOperation } from "../lib/plan-operations";

/** `POST /api/internal/organizations/{organizationId}/billing/hobby-subscriptions`: the onboarding "continue on Hobby" choice. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZOrganizationIdParams },
  action: "subscriptionAccessed",
  targetType: "organization",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    startHobbyPlanOperation({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
