import { responses } from "@/app/lib/api/response";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

import { authOptions } from "@formbricks/lib/authOptions";
import { SLACK_AUTH_URL, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";

export async function GET(req: NextRequest) {
  const environmentId = req.headers.get("environmentId");
  const session = await getServerSession(authOptions);

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is missing");
  }

  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user.id, environmentId);
  if (!canUserAccessEnvironment) {
    return responses.unauthorizedResponse();
  }

  const client_id = SLACK_CLIENT_ID;
  const client_secret = SLACK_CLIENT_SECRET;
  const auth_url = SLACK_AUTH_URL;
  if (!client_id) return responses.internalServerErrorResponse("Slack client id is missing");
  if (!client_secret) return responses.internalServerErrorResponse("Slack client secret is missing");
  if (!auth_url) return responses.internalServerErrorResponse("Slack auth url is missing");

  return responses.successResponse({ authUrl: `${auth_url}&state=${environmentId}` });
}
