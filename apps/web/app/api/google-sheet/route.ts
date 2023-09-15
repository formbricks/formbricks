import { env } from "@/env.mjs";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
];

export async function GET(req: NextRequest) {
  const environmentId = req.headers.get("environmentId");

  const client_id = env.GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = env.GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = env.GOOGLE_SHEETS_REDIRECT_URL;
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
