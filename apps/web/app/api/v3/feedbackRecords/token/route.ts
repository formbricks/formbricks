import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createFeedbackRecordsGatewayToken } from "@/lib/jwt";

export const POST = withV3ApiWrapper({
  auth: "session",
  handler: async ({ authentication }) => {
    const { token, expiresAt } = createFeedbackRecordsGatewayToken(authentication.user.id);
    return Response.json({ token, expiresAt });
  },
});
