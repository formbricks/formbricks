import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { connectAirtable, fetchAirtableAuthToken } from "@formbricks/lib/airtable/service";
import { AIR_TABLE_CLIENT_ID, WEBAPP_URL } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";

async function getEmail(token: string) {
  const req_ = await fetch("https://api.airtable.com/v0/meta/whoami", {
    headers: {
      Authorization: `Bearer ${token}`,
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
  const redirect_uri = WEBAPP_URL + "/api/v1/integrations/airtable/callback";
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

  try {
    const key = await fetchAirtableAuthToken(formData);

    const email = await getEmail(key.access_token);

    await connectAirtable({
      environmentId,
      email,
      key,
    });
    return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/airtable`);
  } catch (error) {
    console.error(error);
    NextResponse.json({ Error: error }, { status: 500 });
  }

  NextResponse.json({ Error: "unknown error occurred" }, { status: 400 });
}
