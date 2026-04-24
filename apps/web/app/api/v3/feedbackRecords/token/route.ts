import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createFeedbackRecordsGatewayToken } from "@/lib/jwt";

export const POST = withV3ApiWrapper({
  auth: "session",
  handler: async ({ authentication }) => {
    const userId = authentication && "user" in authentication ? authentication.user?.id : null;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { token, expiresAt } = createFeedbackRecordsGatewayToken(userId);
    return Response.json({ token, expiresAt });
  },
});
