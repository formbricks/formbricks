import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import {
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
} from "@/lib/constants";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("user" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const workspaceId = req.headers.get("workspaceId");

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

    const client_id = NOTION_OAUTH_CLIENT_ID;
    const client_secret = NOTION_OAUTH_CLIENT_SECRET;
    const auth_url = NOTION_AUTH_URL;
    const redirect_uri = NOTION_REDIRECT_URI;
    if (!client_id)
      return {
        response: responses.internalServerErrorResponse("Notion client id is missing"),
      };
    if (!redirect_uri)
      return {
        response: responses.internalServerErrorResponse("Notion redirect url is missing"),
      };
    if (!client_secret)
      return {
        response: responses.internalServerErrorResponse("Notion client secret is missing"),
      };
    if (!auth_url)
      return {
        response: responses.internalServerErrorResponse("Notion auth url is missing"),
      };

    return {
      response: responses.successResponse({ authUrl: `${auth_url}&state=${workspaceId}` }),
    };
  },
});
