import { authOptions } from "@formbricks/lib/authOptions";
import {
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
} from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

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

  const client_id = NOTION_OAUTH_CLIENT_ID;
  const client_secret = NOTION_OAUTH_CLIENT_SECRET;
  const auth_url = NOTION_AUTH_URL;
  const redirect_uri = NOTION_REDIRECT_URI;
  if (!client_id) return NextResponse.json({ Error: "Notion client id is missing" }, { status: 400 });
  if (!client_secret) return NextResponse.json({ Error: "Notion client secret is missing" }, { status: 400 });
  if (!auth_url) return NextResponse.json({ Error: "Notion auth url is missing" }, { status: 400 });
  if (!redirect_uri) return NextResponse.json({ Error: "Notion redirect url is missing" }, { status: 400 });

  return NextResponse.json({ authUrl: `${auth_url}&state=${environmentId}` }, { status: 200 });
}
