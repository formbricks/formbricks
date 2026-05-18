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

    let oauthState;
    try {
      oauthState = await consumeIntegrationOAuthState({
        provider: "airtable",
        userId: authentication.user.id,
        state,
      });
    } catch (err) {
      if (err instanceof IntegrationOAuthStateError) {
        return {
          response: responses.badRequestResponse("Invalid OAuth state"),
        };
      }

      throw err;
    }

    const workspaceId = oauthState.workspaceId;
    if (!workspaceId || !oauthState.pkceCodeVerifier) {
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

    const basePath = `/workspaces/${workspaceId}`;
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
    const code_verifier = oauthState.pkceCodeVerifier;

    if (!client_id)
      return {
        response: responses.internalServerErrorResponse("Airtable client id is missing"),
      };

    const formData = {
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id,
      code_verifier,
    };

    try {
      const key = await fetchAirtableAuthToken(formData);
      if (!key) {
        return {
          response: responses.notFoundResponse("airtable auth token", key),
        };
      }
      const email = await getEmail(key.access_token);

      // Preserve existing integration data (survey-to-table mappings) when re-authorizing
      const existingIntegration = await getIntegrationByType(workspaceId, "airtable");
      const existingData = existingIntegration?.config?.data ?? [];

      const airtableIntegrationInput = {
        type: "airtable" as const,
        config: {
          key,
          data: existingData,
          email,
        },
      };
      await createOrUpdateIntegration(workspaceId, airtableIntegrationInput);

      try {
        const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
        capturePostHogEvent(
          authentication.user.id,
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

      return {
        response: Response.redirect(redirectUrl),
      };
    } catch (error) {
      logger.error({ error }, "Error in GET /api/v1/integrations/airtable/callback");
      return {
        response: responses.internalServerErrorResponse(
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  },
});
