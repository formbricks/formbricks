import { google } from "googleapis";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { responses } from "@/app/lib/api/response";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "@/lib/constants";
import { createIntegrationOAuthState } from "@/lib/oauth/integration-state";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { getSession } from "@/modules/auth/lib/session";

const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const GET = async (req: NextRequest) => {
  const workspaceId = req.headers.get("workspaceId");
  const session = await getSession();

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
  let state: string;
  try {
    state = await createIntegrationOAuthState({
      provider: "googleSheets",
      userId: session.user.id,
      workspaceId,
    });
  } catch (error) {
    logger.error(
      { error, provider: "googleSheets", userId: session.user.id, workspaceId },
      "Failed to create Google Sheets OAuth state"
    );
    return responses.internalServerErrorResponse("Unable to start OAuth flow");
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state,
  });

  return responses.successResponse({ authUrl });
};
