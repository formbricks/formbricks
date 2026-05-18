import { google } from "googleapis";
import { getServerSession } from "next-auth";
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
import { authOptions } from "@/modules/auth/lib/authOptions";

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const session = await getServerSession(authOptions);
  if (!session) {
    return responses.notAuthenticatedResponse();
  }

  let oauthState;
  try {
    oauthState = await consumeIntegrationOAuthState({
      provider: "googleSheets",
      userId: session.user.id,
      state,
    });
  } catch (err) {
    if (err instanceof IntegrationOAuthStateError) {
      return responses.badRequestResponse("Invalid OAuth state");
    }

    throw err;
  }

  const workspaceId = oauthState.workspaceId;
  const canUserAccessWorkspace = await hasUserWorkspaceAccess(session.user.id, workspaceId);
  if (!canUserAccessWorkspace) {
    return responses.unauthorizedResponse();
  }

  const basePath = `/workspaces/${workspaceId}`;
  const redirectUrl = new URL(`${basePath}/integrations/google-sheets`, WEBAPP_URL);

  const safeError = getSafeOAuthCallbackError(error);
  if (safeError) {
    redirectUrl.searchParams.set("error", safeError);
    return Response.redirect(redirectUrl);
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
  if (result) {
    try {
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
      capturePostHogEvent(session.user.id, "integration_connected", {
        integration_type: "googleSheets",
        organization_id: organizationId,
      });
      capturePostHogEvent(
        session.user.id,
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

    return Response.redirect(redirectUrl);
  }

  return responses.internalServerErrorResponse("Failed to create or update Google Sheets integration");
};
