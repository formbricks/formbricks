import { google } from "googleapis";
import { logger } from "@formbricks/logger";
import { TIntegrationGoogleSheetsConfig } from "@formbricks/types/integration/google-sheet";
import { responses } from "@/app/lib/api/response";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@/lib/constants";
import { createOrUpdateIntegration, getIntegrationByType } from "@/lib/integration/service";
import {
  IntegrationOAuthStateError,
  consumeIntegrationOAuthState,
  getSafeOAuthCallbackError,
} from "@/lib/oauth/integration-state";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { getSession } from "@/modules/auth/lib/session";

const getGoogleSheetsRedirectUrl = (workspaceId: string) =>
  new URL(`/workspaces/${workspaceId}/settings/workspace/integrations/google-sheets`, WEBAPP_URL);

const getGoogleSheetsOAuthState = async (state: string | null, userId: string) => {
  try {
    return await consumeIntegrationOAuthState({
      provider: "googleSheets",
      userId,
      state,
    });
  } catch (err) {
    if (err instanceof IntegrationOAuthStateError) {
      return null;
    }

    throw err;
  }
};

const getGoogleSheetsOAuthClient = () => {
  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;

  if (!client_id) {
    return { response: responses.internalServerErrorResponse("Google client id is missing") };
  }

  if (!client_secret) {
    return { response: responses.internalServerErrorResponse("Google client secret is missing") };
  }

  if (!redirect_uri) {
    return { response: responses.internalServerErrorResponse("Google redirect url is missing") };
  }

  return { client: new google.auth.OAuth2(client_id, client_secret, redirect_uri) };
};

const captureGoogleSheetsConnectedEvent = async (userId: string, workspaceId: string) => {
  try {
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    capturePostHogEvent(userId, "integration_connected", {
      integration_type: "googleSheets",
      organization_id: organizationId,
    });
    capturePostHogEvent(
      userId,
      "integration_connected",
      {
        integration_type: "googleSheets",
        organization_id: organizationId,
        workspace_id: workspaceId,
      },
      { organizationId, workspaceId }
    );
  } catch (err) {
    logger.error({ error: err }, "Failed to capture PostHog integration_connected event for googleSheets");
  }
};

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const session = await getSession();
  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  const oauthState = await getGoogleSheetsOAuthState(state, session.user.id);
  if (!oauthState) {
    return responses.badRequestResponse("Invalid OAuth state");
  }

  const workspaceId = oauthState.workspaceId;
  const canUserAccessWorkspace = await hasUserWorkspaceAccess(session.user.id, workspaceId);
  if (!canUserAccessWorkspace) {
    return responses.unauthorizedResponse();
  }

  const redirectUrl = getGoogleSheetsRedirectUrl(workspaceId);

  const safeError = getSafeOAuthCallbackError(error);
  if (safeError) {
    redirectUrl.searchParams.set("error", safeError);
    return Response.redirect(redirectUrl);
  }

  if (code && typeof code !== "string") {
    return responses.badRequestResponse("`code` must be a string");
  }

  const oAuth2ClientResult = getGoogleSheetsOAuthClient();
  if ("response" in oAuth2ClientResult) {
    return oAuth2ClientResult.response;
  }
  const oAuth2Client = oAuth2ClientResult.client;

  if (!code) {
    return Response.redirect(redirectUrl);
  }

  const token = await oAuth2Client.getToken(code);
  const key = token.res?.data;
  if (!key) {
    return Response.redirect(redirectUrl);
  }

  oAuth2Client.setCredentials({ access_token: key.access_token });
  const oauth2 = google.oauth2({ auth: oAuth2Client, version: "v2" });
  const userInfo = await oauth2.userinfo.get();
  const userEmail = userInfo.data.email;

  if (!userEmail) {
    return responses.internalServerErrorResponse("Failed to get user email");
  }

  const integrationType = "googleSheets" as const;
  const existingIntegration = await getIntegrationByType(workspaceId, integrationType);
  const existingConfig = existingIntegration?.config as TIntegrationGoogleSheetsConfig;

  const googleSheetIntegration = {
    type: integrationType,
    config: {
      key,
      data: existingConfig?.data ?? [],
      email: userEmail,
    },
  };

  const result = await createOrUpdateIntegration(workspaceId, googleSheetIntegration);
  if (!result) {
    return responses.internalServerErrorResponse("Failed to create or update Google Sheets integration");
  }

  await captureGoogleSheetsConnectedEvent(session.user.id, workspaceId);
  return Response.redirect(redirectUrl);
};
