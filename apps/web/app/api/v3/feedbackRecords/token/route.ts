import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createGatewayServiceTokenResponse } from "@/modules/gateway-auth/lib/token";

export const POST = withV3ApiWrapper({
  auth: "session",
  handler: async ({ authentication }) => {
    return createGatewayServiceTokenResponse(authentication, "feedbackRecords");
  },
});
