import { responses } from "@/app/lib/api/response";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";

const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

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

  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;
  if (!client_id) return responses.internalServerErrorResponse("Google client id is missing");
  if (!client_secret) return responses.internalServerErrorResponse("Google client secret is missing");
  if (!redirect_uri) return responses.internalServerErrorResponse("Google redirect url is missing");
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: environmentId!,
  });

  return responses.successResponse({ authUrl });
};
