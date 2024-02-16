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

  console.log("================HERE's the Session===================");
  console.log(session);
  const { user } = session;

  const slackCredentials: TIntegrationSlackCredential = {
    token_type: "Bearer",
    // @ts-ignore
    id_token: user.idToken,
    // @ts-ignore
    access_token: user.accessToken,
    // @ts-ignore
    refresh_token: user.refreshToken,
    // @ts-ignore
    expiry_date: user.expiresAt,
  };

  const slackConfiguration: TIntegrationSlackConfig = {
    data: [],
    key: slackCredentials,
    user: {
      id: user.id,
      name: user.name as string,
      email: user.email as string,
      avatar: user.imageUrl as string,
    },
  };

  const slackIntegrationObject = {
    type: "slack" as "slack",
    environment: environmentId,
    config: slackConfiguration,
  };

  // Add the Slack Integration Object to the Database
  const result = await createOrUpdateIntegration(environmentId, slackIntegrationObject);
  if (result) {
    return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/slack`);
  }
}
