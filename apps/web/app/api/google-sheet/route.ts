import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { responses } from "@/app/lib/api/response";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "@/lib/constants";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";

const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const GET = async (req: NextRequest) => {
  const workspaceId = req.headers.get("workspaceId");
  const session = await getServerSession(authOptions);

  if (!workspaceId) {
    return responses.badRequestResponse("workspaceId is missing");
  }

  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  const canUserAccessWorkspace = await hasUserWorkspaceAccess(session?.user.id, workspaceId);
  if (!canUserAccessWorkspace) {
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
    state: workspaceId,
  });

  return responses.successResponse({ authUrl });
};
