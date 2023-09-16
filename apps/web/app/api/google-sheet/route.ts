import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";

const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
];

export async function GET(req: NextRequest) {
  const environmentId = req.headers.get("environmentId");
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ Error: "Invalid session" }, { status: 400 });
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user, environmentId);
  if (!canUserAccessEnvironment) {
    return NextResponse.json({ Error: "You dont have access to environment" }, { status: 401 });
  }

  const client_id = process.env.GOOGLE_APP_CLIENT_ID;
  const client_secret = process.env.GOOGLE_APP_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_APP_REDIRECT_URL;
  if (!client_id) return NextResponse.json({ Error: "Google client id is missing" }, { status: 400 });
  if (!client_secret) return NextResponse.json({ Error: "Google client secret is missing" }, { status: 400 });
  if (!redirect_uri) return NextResponse.json({ Error: "Google redirect url is missing" }, { status: 400 });
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: environmentId!,
  });

  return NextResponse.json({ authUrl }, { status: 200 });
}
