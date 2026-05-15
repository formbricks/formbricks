import { logger } from "@formbricks/logger";
import { TIntegrationNotionInput } from "@formbricks/types/integration/notion";
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
import { createOrUpdateIntegration, getIntegrationByType } from "@/lib/integration/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("user" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const url = req.url;
    const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
    const workspaceId = queryParams.get("state"); // Get the value of the 'state' parameter
    const code = queryParams.get("code");
    const error = queryParams.get("error");

    if (!workspaceId) {
      return {
        response: responses.badRequestResponse("Invalid workspaceId"),
      };
    }

    const canUserAccessWorkspace = await hasUserWorkspaceAccess(authentication.user.id, workspaceId);
    if (!canUserAccessWorkspace) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    const basePath = `/workspaces/${workspaceId}`;

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

      const existingIntegration = await getIntegrationByType(workspaceId, "notion");
      if (existingIntegration) {
        notionIntegration.config.data = existingIntegration.config.data;
      }

      const result = await createOrUpdateIntegration(workspaceId, notionIntegration);

      if (result) {
        try {
          const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
          capturePostHogEvent(
            authentication.user.id,
            "integration_connected",
            {
              integration_type: "notion",
              organization_id: organizationId,
              workspace_id: workspaceId,
            },
            { organizationId, workspaceId }
          );
        } catch (err) {
          logger.error({ error: err }, "Failed to capture PostHog integration_connected event for notion");
        }

        return {
          response: Response.redirect(`${WEBAPP_URL}${basePath}/integrations/notion`),
        };
      }
    } else if (error) {
      return {
        response: Response.redirect(`${WEBAPP_URL}${basePath}/integrations/notion?error=${error}`),
      };
    }

    return {
      response: responses.badRequestResponse("Missing code or error parameter"),
    };
  },
});
