import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@formbricks/database";
import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { TSlackConfig } from "@formbricks/types/integration/slack";

export async function GET(req: NextRequest, res: NextResponse) {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("environment"); // Get the value of the 'state' parameter

  console.log("yooooooo", environmentId);

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

  console.log(session, session.user);
  console.log("================HERE's the Session===================");
  const { user } = session;
  // __AUTO_GENERATED_PRINT_VAR_START__
  console.log("GET user: %s", user); // __AUTO_GENERATED_PRINT_VAR_END__

  // @ts-ignore
  const slackCredentials: TSlackCredential = {
    token_type: "Bearer",
    // @ts-ignore
    access_token: user.accessToken,
    // @ts-ignore
    refresh_token: user.refreshToken,
    // @ts-ignore
    expiry_date: user.expiresAt,
  };

  const slackConfiguration: TSlackConfig = {
    data: [],
    key: slackCredentials,
    user: {
      id: user.id,
      name: user.name as string,
      email: user.email as string,
      avatar: user.imageUrl as string,
    },
  };

  // @ts-ignore
  //   const slackIntegrationObject: TSlackIntegration = {
  //     type: "slack",
  //     environment: environmentId,
  //     config: slackConfiguration,
  //   }

  const slackIntegrationObject = {
    type: "slack" as "slack",
    environment: environmentId,
    config: slackConfiguration,
  };

  // Add the Slack Integration Object to the Database
  const result = await prisma.integration.upsert({
    where: {
      type_environmentId: {
        environmentId,
        type: "slack",
      },
    },
    update: {
      ...slackIntegrationObject,
      environment: { connect: { id: environmentId } },
    },
    create: {
      ...slackIntegrationObject,
      environment: { connect: { id: environmentId } },
    },
  });

  if (result) {
    return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/slack`);
  }
}
