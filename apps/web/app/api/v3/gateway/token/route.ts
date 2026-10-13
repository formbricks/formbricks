import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZGatewayAuthService } from "@/modules/gateway-auth/lib/service";
import { createGatewayServiceTokenResponse } from "@/modules/gateway-auth/lib/token";

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "jwtTokenCreated",
  targetType: "user",
  schemas: {
    body: z.object({
      service: ZGatewayAuthService,
    }),
  },
  handler: async ({ authentication, parsedInput, auditLog }) => {
    return createGatewayServiceTokenResponse(authentication, parsedInput.body.service, auditLog);
  },
});
