import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { TIntegrationGoogleSheetsConfig } from "@formbricks/types/integration/google-sheet";
import { responses } from "@/app/lib/api/response";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { createOrUpdateIntegration, getIntegrationByType } from "@/lib/integration/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const environmentId = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!environmentId) {
    return responses.badRequestResponse("Invalid environmentId");
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!canUserAccessEnvironment) {
    return responses.unauthorizedResponse();
  }

  if (code && typeof code !== "string") {
    return responses.badRequestResponse("`code` must be a string");
  }

  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;
  if (!client_id) return responses.internalServerErrorResponse("Google client id is missing");
  if (!client_secret) return responses.internalServerErrorResponse("Google client secret is missing");
  if (!redirect_uri) return responses.internalServerErrorResponse("Google redirect url is missing");
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

  if (!code) {
    return Response.redirect(
      `${WEBAPP_URL}/environments/${environmentId}/workspace/integrations/google-sheets`
    );
  }

  const token = await oAuth2Client.getToken(code);
  const key = token.res?.data;
  if (!key) {
    return Response.redirect(
      `${WEBAPP_URL}/environments/${environmentId}/workspace/integrations/google-sheets`
    );
  }

  oAuth2Client.setCredentials({ access_token: key.access_token });
  const oauth2 = google.oauth2({ auth: oAuth2Client, version: "v2" });
  const userInfo = await oauth2.userinfo.get();
  const userEmail = userInfo.data.email;

  if (!userEmail) {
    return responses.internalServerErrorResponse("Failed to get user email");
  }

  const integrationType = "googleSheets" as const;
  const existingIntegration = await getIntegrationByType(environmentId, integrationType);
  const existingConfig = existingIntegration?.config as TIntegrationGoogleSheetsConfig;

  const googleSheetIntegration = {
    type: integrationType,
    environment: environmentId,
    config: {
      key,
      data: existingConfig?.data ?? [],
      email: userEmail,
    },
  };

  const result = await createOrUpdateIntegration(environmentId, googleSheetIntegration);
  if (result) {
    return Response.redirect(
      `${WEBAPP_URL}/environments/${environmentId}/workspace/integrations/google-sheets`
    );
  }

  return responses.internalServerErrorResponse("Failed to create or update Google Sheets integration");
};
