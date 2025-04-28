import { responses } from "@/app/lib/api/response";
import { SLACK_AUTH_URL, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

export const GET = async (req: NextRequest) => {
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

  if (!SLACK_CLIENT_ID) return responses.internalServerErrorResponse("Slack client id is missing");
  if (!SLACK_CLIENT_SECRET) return responses.internalServerErrorResponse("Slack client secret is missing");
  if (!SLACK_AUTH_URL) return responses.internalServerErrorResponse("Slack auth url is missing");

  return responses.successResponse({ authUrl: `${SLACK_AUTH_URL}&state=${environmentId}` });
};
