import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createGatewayServiceTokenResponse } from "@/modules/gateway-auth/lib/token";

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "jwtTokenCreated",
  targetType: "user",
  handler: async ({ authentication, auditLog }) => {
    return createGatewayServiceTokenResponse(authentication, "feedbackRecords", auditLog);
  },
});
