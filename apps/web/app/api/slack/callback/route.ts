import { prisma } from "@formbricks/database";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { NextRequest, NextResponse } from "next/server";
import { TSlackConfig, TSlackCredential, TSlackIntegration } from "@formbricks/types/v1/integrations";

export async function GET(req: NextRequest, res: NextResponse) {
  const url = req.url;
  // __AUTO_GENERATED_PRINT_VAR_START__
  console.log("RANN GET url: %s", url); // __AUTO_GENERATED_PRINT_VAR_END__
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("environment"); // Get the value of the 'state' parameter

  console.log(environmentId);

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
  const { user } = session;

  // @ts-ignore
  const slackCredentials: TSlackCredential = {
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

  const slackConfiguration: TSlackConfig = {
    data: [],
    key: slackCredentials,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.image,
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
