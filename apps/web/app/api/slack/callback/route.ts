import { responses } from "@/app/lib/api/response";
import { NextRequest } from "next/server";

import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { createOrUpdateIntegration } from "@formbricks/lib/integration/service";
import { TIntegrationSlackConfig, TIntegrationSlackCredential } from "@formbricks/types/integration/slack";

export async function GET(req: NextRequest) {
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

  const client_id = SLACK_CLIENT_ID;
  const client_secret = SLACK_CLIENT_SECRET;

  if (!client_id) return responses.internalServerErrorResponse("Slack client id is missing");
  if (!client_secret) return responses.internalServerErrorResponse("Slack client secret is missing");

  const formData = new FormData();
  formData.append("code", code ?? "");
  formData.append("client_id", client_id ?? "");
  formData.append("client_secret", client_secret ?? "");

  if (code) {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    const slackCredentials: TIntegrationSlackCredential = {
      token_type: "Bearer",
      access_token: data.access_token,
    };

    const slackConfiguration: TIntegrationSlackConfig = {
      data: [],
      key: slackCredentials,
      user: data.team,
    };

    const slackIntegration = {
      type: "slack" as "slack",
      environment: environmentId,
      config: slackConfiguration,
    };

    const result = await createOrUpdateIntegration(environmentId, slackIntegration);

    if (result) {
      return Response.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/slack`);
    }
  } else if (error) {
    return Response.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/slack?error=${error}`);
  }
}
