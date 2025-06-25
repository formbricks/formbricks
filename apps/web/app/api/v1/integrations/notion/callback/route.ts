import { responses } from "@/app/lib/api/response";
import {
  ENCRYPTION_KEY,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@/lib/constants";
import { symmetricEncrypt } from "@/lib/crypto";
import { createOrUpdateIntegration, getIntegrationByType } from "@/lib/integration/service";
import { NextRequest } from "next/server";
import { TIntegrationNotionConfigData, TIntegrationNotionInput } from "@formbricks/types/integration/notion";

export const GET = async (req: NextRequest) => {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
  const code = queryParams.get("code");
  const error = queryParams.get("error");

  if (!environmentId) {
    return responses.badRequestResponse("Invalid environmentId");
  }

  if (code && typeof code !== "string") {
    return responses.badRequestResponse("`code` must be a string");
  }

  const client_id = NOTION_OAUTH_CLIENT_ID;
  const client_secret = NOTION_OAUTH_CLIENT_SECRET;
  const redirect_uri = NOTION_REDIRECT_URI;
  if (!client_id) return responses.internalServerErrorResponse("Notion client id is missing");
  if (!redirect_uri) return responses.internalServerErrorResponse("Notion redirect url is missing");
  if (!client_secret) return responses.internalServerErrorResponse("Notion client secret is missing");
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
    const encryptedAccessToken = symmetricEncrypt(tokenData.access_token, ENCRYPTION_KEY!);
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
      return Response.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/notion`);
    }
  } else if (error) {
    return Response.redirect(
      `${WEBAPP_URL}/environments/${environmentId}/integrations/notion?error=${error}`
    );
  }
};
