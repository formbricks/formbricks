import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { createOrUpdateIntegration } from "@formbricks/lib/integration/service";
import { TIntegrationSlackConfig, TIntegrationSlackCredential } from "@formbricks/types/integration/slack";

export async function GET(req: NextRequest, res: NextResponse) {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("environment"); // Get the value of the 'state' parameter

  const session = await getServerSession(authOptions);

  if (!session || !environmentId) {
    console.log("there is either no session or environementid");
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  // @ts-expect-error
  const { slack } = session;

  if (!slack) {
    console.log("slack session is not defined");
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const slackCredentials: TIntegrationSlackCredential = {
    token_type: "Bearer",
    access_token: slack.accessToken,
    refresh_token: slack.refreshToken,
    expiry_date: slack.expiresAt,
  };

  const slackConfiguration: TIntegrationSlackConfig = {
    data: [],
    key: slackCredentials,
    user: {
      id: slack.id,
      name: slack.name as string,
      email: slack.email as string,
    },
  };

  const slackIntegrationObject = {
    type: "slack" as "slack",
    environment: environmentId,
    config: slackConfiguration,
  };

  const result = await createOrUpdateIntegration(environmentId, slackIntegrationObject);

  if (result) {
    return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/slack`);
  }
}
