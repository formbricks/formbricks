import { logger } from "@formbricks/logger";
import { TIntegrationNotionConfigData, TIntegrationNotionInput } from "@formbricks/types/integration/notion";
import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import {
  ENCRYPTION_KEY,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@/lib/constants";
import { symmetricEncrypt } from "@/lib/crypto";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { createOrUpdateIntegration, getIntegrationByType } from "@/lib/integration/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("user" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const url = req.url;
    const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
    const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
    const code = queryParams.get("code");
    const error = queryParams.get("error");

    if (!environmentId) {
      return {
        response: responses.badRequestResponse("Invalid environmentId"),
      };
    }

    const canUserAccessEnvironment = await hasUserEnvironmentAccess(authentication.user.id, environmentId);
    if (!canUserAccessEnvironment) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    if (code && typeof code !== "string") {
      return {
        response: responses.badRequestResponse("`code` must be a string"),
      };
    }

    const client_id = NOTION_OAUTH_CLIENT_ID;
    const client_secret = NOTION_OAUTH_CLIENT_SECRET;
    const redirect_uri = NOTION_REDIRECT_URI;
    if (!client_id)
      return {
        response: responses.internalServerErrorResponse("Notion client id is missing"),
      };
    if (!redirect_uri)
      return {
        response: responses.internalServerErrorResponse("Notion redirect url is missing"),
      };
    if (!client_secret)
      return {
        response: responses.internalServerErrorResponse("Notion client secret is missing"),
      };
    if (code) {
      // encode in base 64
      const encoded = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

      const response = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${encoded}`,
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirect_uri,
        }),
      });

      const tokenData = await response.json();
      const encryptedAccessToken = symmetricEncrypt(tokenData.access_token, ENCRYPTION_KEY);
      tokenData.access_token = encryptedAccessToken;

      const notionIntegration: TIntegrationNotionInput = {
        type: "notion" as "notion",
        config: {
          key: tokenData,
          data: [],
        },
      };

      const existingIntegration = await getIntegrationByType(environmentId, "notion");
      if (existingIntegration) {
        notionIntegration.config.data = existingIntegration.config.data as TIntegrationNotionConfigData[];
      }

      const result = await createOrUpdateIntegration(environmentId, notionIntegration);

      if (result) {
        try {
          const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
          const projectId = await getProjectIdFromEnvironmentId(environmentId);
          capturePostHogEvent(
            authentication.user.id,
            "integration_connected",
            {
              integration_type: "notion",
              organization_id: organizationId,
              workspace_id: projectId,
              environment_id: environmentId,
            },
            { organizationId, workspaceId: projectId }
          );
        } catch (err) {
          logger.error({ error: err }, "Failed to capture PostHog integration_connected event for notion");
        }

        return {
          response: Response.redirect(
            `${WEBAPP_URL}/environments/${environmentId}/workspace/integrations/notion`
          ),
        };
      }
    } else if (error) {
      return {
        response: Response.redirect(
          `${WEBAPP_URL}/environments/${environmentId}/workspace/integrations/notion?error=${error}`
        ),
      };
    }

    return {
      response: responses.badRequestResponse("Missing code or error parameter"),
    };
  },
});
