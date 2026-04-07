import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { SLACK_AUTH_URL, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } from "@/lib/constants";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    // session authentication
    if (!authentication || !("user" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const workspaceId = req.headers.get("workspaceId") ?? req.headers.get("environmentId");

    if (!workspaceId) {
      return {
        response: responses.badRequestResponse("workspaceId is missing"),
      };
    }

    const canUserAccessWorkspace = await hasUserWorkspaceAccess(authentication.user.id, workspaceId);
    if (!canUserAccessWorkspace) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    if (!SLACK_CLIENT_ID)
      return {
        response: responses.internalServerErrorResponse("Slack client id is missing"),
      };
    if (!SLACK_CLIENT_SECRET)
      return {
        response: responses.internalServerErrorResponse("Slack client secret is missing"),
      };
    if (!SLACK_AUTH_URL)
      return {
        response: responses.internalServerErrorResponse("Slack auth url is missing"),
      };

    return {
      response: responses.successResponse({ authUrl: `${SLACK_AUTH_URL}&state=${workspaceId}` }),
    };
  },
});
