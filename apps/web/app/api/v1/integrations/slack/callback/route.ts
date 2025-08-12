import { responses } from "@/app/lib/api/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, WEBAPP_URL } from "@/lib/constants";
import { createOrUpdateIntegration, getIntegrationByType } from "@/lib/integration/service";
import { NextRequest } from "next/server";
import {
  TIntegrationSlackConfig,
  TIntegrationSlackConfigData,
  TIntegrationSlackCredential,
} from "@formbricks/types/integration/slack";

export const GET = withV1ApiWrapper({
  handler: async ({ req }: { req: NextRequest }) => {
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

    if (code && typeof code !== "string") {
      return {
        response: responses.badRequestResponse("`code` must be a string"),
      };
    }

    if (!SLACK_CLIENT_ID)
      return {
        response: responses.internalServerErrorResponse("Slack client id is missing"),
      };
    if (!SLACK_CLIENT_SECRET)
      return {
        response: responses.internalServerErrorResponse("Slack client secret is missing"),
      };

    const formData = {
      code,
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
    };
    const formBody: string[] = [];
    for (const property in formData) {
      const encodedKey = encodeURIComponent(property);
      const encodedValue = encodeURIComponent(formData[property]);
      formBody.push(encodedKey + "=" + encodedValue);
    }
    const bodyString = formBody.join("&");
    if (code) {
      const response = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        body: bodyString,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const data = await response.json();

      if (!data.ok) {
        return {
          response: responses.badRequestResponse(data.error),
        };
      }

      const slackCredentials: TIntegrationSlackCredential = {
        app_id: data.app_id,
        authed_user: data.authed_user,
        token_type: data.token_type,
        access_token: data.access_token,
        bot_user_id: data.bot_user_id,
        team: data.team,
      };

      const slackIntegration = await getIntegrationByType(environmentId, "slack");

      const slackConfiguration: TIntegrationSlackConfig = {
        data: (slackIntegration?.config.data as TIntegrationSlackConfigData[]) ?? [],
        key: slackCredentials,
      };

      const integration = {
        type: "slack" as "slack",
        environment: environmentId,
        config: slackConfiguration,
      };

      const result = await createOrUpdateIntegration(environmentId, integration);

      if (result) {
        return {
          response: Response.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/slack`),
        };
      }
    } else if (error) {
      return {
        response: Response.redirect(
          `${WEBAPP_URL}/environments/${environmentId}/integrations/slack?error=${error}`
        ),
      };
    }

    return {
      response: responses.badRequestResponse("Missing code or error parameter"),
    };
  },
});
