import * as z from "zod";
import { logger } from "@formbricks/logger";
import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { fetchAirtableAuthToken } from "@/lib/airtable/service";
import { AIRTABLE_CLIENT_ID, WEBAPP_URL } from "@/lib/constants";
import { createOrUpdateIntegration, getIntegrationByType } from "@/lib/integration/service";
import {
  IntegrationOAuthStateError,
  consumeIntegrationOAuthState,
  getSafeOAuthCallbackError,
} from "@/lib/oauth/integration-state";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";

const getEmail = async (token: string) => {
  const req_ = await fetch("https://api.airtable.com/v0/meta/whoami", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const res_ = await req_.json();

  return z.string().parse(res_?.email);
};

const getSanitizedAirtableOAuthError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { message: "Unknown Airtable OAuth callback error" };
  }

  const status = (error as { status?: unknown }).status;

  return {
    message: error.message,
    name: error.name,
    ...(typeof status === "number" ? { status } : {}),
  };
};

const getAirtableOAuthState = async (state: string | null, userId: string) => {
  try {
    return await consumeIntegrationOAuthState({
      provider: "airtable",
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

const captureAirtableConnectedEvent = async (userId: string, workspaceId: string) => {
  try {
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    capturePostHogEvent(
      userId,
      "integration_connected",
      {
        integration_type: "airtable",
        organization_id: organizationId,
        workspace_id: workspaceId,
      },
      { organizationId, workspaceId }
    );
  } catch (err) {
    logger.error({ error: err }, "Failed to capture PostHog integration_connected event for airtable");
  }
};

const createAirtableIntegration = async ({
  clientId,
  code,
  codeVerifier,
  redirectUri,
  workspaceId,
}: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  workspaceId: string;
}) => {
  const key = await fetchAirtableAuthToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  if (!key) {
    return responses.notFoundResponse("airtable auth token", key);
  }

  const email = await getEmail(key.access_token);

  // Preserve existing integration data (survey-to-table mappings) when re-authorizing
  const existingIntegration = await getIntegrationByType(workspaceId, "airtable");
  const existingData = existingIntegration?.config?.data ?? [];

  await createOrUpdateIntegration(workspaceId, {
    type: "airtable" as const,
    config: {
      key,
      data: existingData,
      email,
    },
  });

  return null;
};

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("user" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const url = req.url;
    const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
    const state = queryParams.get("state");
    const code = queryParams.get("code");
    const error = queryParams.get("error");

    const oauthState = await getAirtableOAuthState(state, authentication.user.id);
    if (!oauthState) {
      return {
        response: responses.badRequestResponse("Invalid OAuth state"),
      };
    }

    const workspaceId = oauthState.workspaceId;
    const codeVerifier = oauthState.pkceCodeVerifier;
    if (!workspaceId || !codeVerifier) {
      return {
        response: responses.badRequestResponse("Invalid OAuth state"),
      };
    }

    const canUserAccessWorkspace = await hasUserWorkspaceAccess(authentication.user.id, workspaceId);
    if (!canUserAccessWorkspace) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    const basePath = `/workspaces/${workspaceId}/settings/workspace`;
    const redirectUrl = new URL(`${basePath}/integrations/airtable`, WEBAPP_URL);
    const safeError = getSafeOAuthCallbackError(error);

    if (!code && safeError) {
      redirectUrl.searchParams.set("error", safeError);
      return {
        response: Response.redirect(redirectUrl),
      };
    }

    if (!code) {
      return {
        response: responses.badRequestResponse("`code` is missing"),
      };
    }

    const client_id = AIRTABLE_CLIENT_ID;
    const redirect_uri = WEBAPP_URL + "/api/v1/integrations/airtable/callback";

    if (!client_id)
      return {
        response: responses.internalServerErrorResponse("Airtable client id is missing"),
      };

    try {
      const integrationErrorResponse = await createAirtableIntegration({
        clientId: client_id,
        code,
        codeVerifier,
        redirectUri: redirect_uri,
        workspaceId,
      });

      if (integrationErrorResponse) {
        return { response: integrationErrorResponse };
      }

      await captureAirtableConnectedEvent(authentication.user.id, workspaceId);

      return {
        response: Response.redirect(redirectUrl),
      };
    } catch (error) {
      logger.error(
        { error: getSanitizedAirtableOAuthError(error) },
        "Error in GET /api/v1/integrations/airtable/callback"
      );
      return {
        response: responses.internalServerErrorResponse("Unable to complete Airtable OAuth flow"),
      };
    }
  },
});
