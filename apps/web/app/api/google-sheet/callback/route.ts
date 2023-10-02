import { prisma } from "@formbricks/database";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  WEBAPP_URL,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "@formbricks/lib/constants";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
  const code = queryParams.get("code");

  if (!environmentId) {
    return NextResponse.json({ error: "Invalid environmentId" });
  }

  if (code && typeof code !== "string") {
    return NextResponse.json({ message: "`code` must be a string" }, { status: 400 });
  }

  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;
  if (!client_id) return NextResponse.json({ Error: "Google client id is missing" }, { status: 400 });
  if (!client_secret) return NextResponse.json({ Error: "Google client secret is missing" }, { status: 400 });
  if (!redirect_uri) return NextResponse.json({ Error: "Google redirect url is missing" }, { status: 400 });
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

  let key;
  let userEmail;

  if (code) {
    const token = await oAuth2Client.getToken(code);
    key = token.res?.data;

    // Set credentials using the provided token
    oAuth2Client.setCredentials({
      access_token: key.access_token,
    });

    // Fetch user's email
    const oauth2 = google.oauth2({
      auth: oAuth2Client,
      version: "v2",
    });
    const userInfo = await oauth2.userinfo.get();
    userEmail = userInfo.data.email;
  }

  const googleSheetIntegration = {
    type: "googleSheets" as "googleSheets",
    environment: environmentId,
    config: {
      key,
      data: [],
      email: userEmail,
    },
  };

  const result = await prisma.integration.upsert({
    where: {
      type_environmentId: {
        environmentId,
        type: "googleSheets",
      },
    },
    update: {
      ...googleSheetIntegration,
      environment: { connect: { id: environmentId } },
    },
    create: {
      ...googleSheetIntegration,
      environment: { connect: { id: environmentId } },
    },
  });

  if (result) {
    return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/google-sheets`);
  }
}
