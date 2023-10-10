import { hasUserEnvironmentAccess } from "@/../../packages/lib/environment/auth";
import { connectAirtable } from "@/../../packages/lib/services/airTable";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { WEBAPP_URL, AIR_TABLE_CLIENT_ID, AIR_TABLE_REDIRECT_URL } from "@formbricks/lib/constants";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";

const TokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.coerce.number(),
});

async function getEmail(token: { access_token: string }) {
  const req_ = await fetch("https://api.airtable.com/v0/meta/whoami", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  const res_ = await req_.json();

  return z.string().parse(res_?.email);
}

export async function GET(req: NextRequest) {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
  const code = queryParams.get("code");
  const session = await getServerSession(authOptions);

  if (!environmentId) {
    return NextResponse.json({ error: "Invalid environmentId" });
  }

  if (!session) {
    return NextResponse.json({ Error: "Invalid session" }, { status: 400 });
  }

  if (code && typeof code !== "string") {
    return NextResponse.json({ message: "`code` must be a string" }, { status: 400 });
  }
  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user.id, environmentId);
  if (!canUserAccessEnvironment) {
    return NextResponse.json({ Error: "You dont have access to environment" }, { status: 401 });
  }

  const client_id = AIR_TABLE_CLIENT_ID;
  const redirect_uri = AIR_TABLE_REDIRECT_URL;
  const code_verifier = Buffer.from(environmentId + session.user.id + environmentId).toString("base64");

  if (!client_id) return NextResponse.json({ Error: "Airtable client id is missing" }, { status: 400 });
  if (!redirect_uri) return NextResponse.json({ Error: "Airtable redirect url is missing" }, { status: 400 });

  const formData = {
    grant_type: "authorization_code",
    code,
    redirect_uri,
    client_id,
    code_verifier,
  };

  const formBody = Object.keys(formData)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(formData[key])}`)
    .join("&");

  const tokenReq = await fetch("https://airtable.com/oauth2/v1/token", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody,
    method: "POST",
  });

  const tokenRes = await tokenReq.json();

  try {
    const token = TokenSchema.parse(tokenRes);

    const email = await getEmail(token);

    await connectAirtable(environmentId, token.access_token, email);
    return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/airtable`);
  } catch (error) {}

  NextResponse.json({ Error: tokenRes?.error?.message ?? "unknown error occurred" }, { status: 400 });
}
