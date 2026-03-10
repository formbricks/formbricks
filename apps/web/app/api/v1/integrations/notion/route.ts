import { NextRequest } from "next/server";
import { responses } from "@/app/lib/api/response";
import { TApiV1Authentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import {
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
} from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }: { req: NextRequest; authentication?: TApiV1Authentication }) => {
    if (!authentication || !("user" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const environmentId = req.headers.get("environmentId");

    if (!environmentId) {
      return {
        response: responses.badRequestResponse("environmentId is missing"),
      };
    }

    const canUserAccessEnvironment = await hasUserEnvironmentAccess(authentication.user.id, environmentId);
    if (!canUserAccessEnvironment) {
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
      response: responses.successResponse({ authUrl: `${auth_url}&state=${environmentId}` }),
    };
  },
});
