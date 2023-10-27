import { prisma } from "@formbricks/database";
import {
  ENCRYPTION_KEY,
  NOTION_AUTH_URL,
  NOTION_OAUTH_CLIENT_ID,
  NOTION_OAUTH_CLIENT_SECRET,
  NOTION_REDIRECT_URI,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { symmetricEncrypt } from "@formbricks/lib/crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
  const code = queryParams.get("code");
  const error = queryParams.get("error");

  if (!environmentId) {
    return NextResponse.json({ Error: "Invalid environmentId" });
  }

  if (code && typeof code !== "string") {
    return NextResponse.json({ message: "`code` must be a string" }, { status: 400 });
  }

  const client_id = NOTION_OAUTH_CLIENT_ID;
  const client_secret = NOTION_OAUTH_CLIENT_SECRET;
  const auth_url = NOTION_AUTH_URL;
  const redirect_uri = NOTION_REDIRECT_URI;
  if (!client_id) return NextResponse.json({ Error: "Notion client id is missing" }, { status: 400 });
  if (!client_secret) return NextResponse.json({ Error: "Notion client secret is missing" }, { status: 400 });
  if (!auth_url) return NextResponse.json({ Error: "Notion auth url is missing" }, { status: 400 });
  if (!redirect_uri) return NextResponse.json({ Error: "Notion redirect url is missing" }, { status: 400 });

  if (code) {
    // encode in base 64
    const encoded = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    const tokenData = await response.json();
    const encryptedAccessToken = symmetricEncrypt(tokenData.access_token, ENCRYPTION_KEY);
    tokenData.access_token = encryptedAccessToken;

    const notionIntegration = {
      type: "notion" as "notion",
      environment: environmentId,
      config: {
        key: tokenData,
        data: [],
      },
    };

    const result = await prisma.integration.upsert({
      where: {
        type_environmentId: {
          environmentId,
          type: "notion",
        },
      },
      update: {
        ...notionIntegration,
        environment: { connect: { id: environmentId } },
      },
      create: {
        ...notionIntegration,
        environment: { connect: { id: environmentId } },
      },
    });

    if (result) {
      return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/notion`);
    }
  } else if (error) {
    return NextResponse.redirect(
      `${WEBAPP_URL}/environments/${environmentId}/integrations/notion?error=${error}`
    );
  }
}
