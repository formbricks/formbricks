import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { Session } from "next-auth";
import { prisma } from "@formbricks/database";
import { EnvironmentType } from "@prisma/client";
import { populateEnvironment } from "@/lib/populate";
import { getEnvironmentBySession } from "@formbricks/lib/services/environment";
import { NextResponse } from "next/server";

type TAuthenticationApiKey = {
  type: "apiKey";
  environmentId: string;
};

type TAuthenticationSession = {
  type: "session";
  session: Session;
  environmentId: string | undefined;
};

type TAuthentication = TAuthenticationApiKey | TAuthenticationSession;

export async function getAuthentication(request: Request): Promise<TAuthentication | null> {
  const apiKey = request.headers.get("x-api-key");
  console.log(apiKey);
  const session = await getServerSession(authOptions);

  if (apiKey) {
    const apiKeyData = await getApiKeyFromKey(apiKey);
    if (apiKeyData) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId: apiKeyData.environmentId,
      };
      return authentication;
    }
  } else if (session) {
    const environmentData = await getEnvironmentBySession(session.user);
    console.log(environmentData);
    const authentication: TAuthenticationSession = {
      type: "session",
      session: session,
      environmentId: environmentData?.id,
    };
    console.log(authentication);
    return authentication;
  }
  return null;
}
