import { responses } from "@/app/lib/api/response";
import { TSessionAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { SLACK_AUTH_URL, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { NextRequest } from "next/server";

export const GET = withV1ApiWrapper({
  handler: async ({
    req,
    authentication,
  }: {
    req: NextRequest;
    authentication: NonNullable<TSessionAuthentication>;
  }) => {
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
      response: responses.successResponse({ authUrl: `${SLACK_AUTH_URL}&state=${environmentId}` }),
    };
  },
});
