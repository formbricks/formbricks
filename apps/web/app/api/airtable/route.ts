import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import crypto from "crypto";

import { AIR_TABLE_CLIENT_ID, AIR_TABLE_REDIRECT_URL } from "@formbricks/lib/constants";

const scope = `data.records:read data.records:write schema.bases:read schema.bases:write user.email:read`;

export async function GET(req: NextRequest) {
  const environmentId = req.headers.get("environmentId");
  const session = await getServerSession(authOptions);

  if (!environmentId) {
    return NextResponse.json({ Error: "environmentId is missing" }, { status: 400 });
  }

  if (!session) {
    return NextResponse.json({ Error: "Invalid session" }, { status: 400 });
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user.id, environmentId);
  if (!canUserAccessEnvironment) {
    return NextResponse.json({ Error: "You dont have access to environment" }, { status: 401 });
  }

  const client_id = AIR_TABLE_CLIENT_ID;
  const redirect_uri = AIR_TABLE_REDIRECT_URL;
  if (!client_id) return NextResponse.json({ Error: "Airtable client id is missing" }, { status: 400 });
  if (!redirect_uri) return NextResponse.json({ Error: "Airtable redirect url is missing" }, { status: 400 });

  const codeVerifier = Buffer.from(environmentId + session.user.id + environmentId).toString("base64");

  const codeChallengeMethod = "S256";
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier) // hash the code verifier with the sha256 algorithm
    .digest("base64") // base64 encode, needs to be transformed to base64url
    .replace(/=/g, "") // remove =
    .replace(/\+/g, "-") // replace + with -
    .replace(/\//g, "_"); // replace / with _ now base64url encoded

  const authUrl = new URL("https://airtable.com/oauth2/v1/authorize");

  authUrl.searchParams.append("client_id", client_id);
  authUrl.searchParams.append("redirect_uri", redirect_uri);
  authUrl.searchParams.append("state", environmentId);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("code_challenge_method", codeChallengeMethod);
  authUrl.searchParams.append("code_challenge", codeChallenge);

  return NextResponse.json({ authUrl: authUrl.toString() }, { status: 200 });
}
