import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@formbricks/database";
import { WEBAPP_URL } from "@formbricks/lib/constants";

export async function GET(req: NextRequest) {

    const url = req.url;
    const queryParams = new URLSearchParams(url.split('?')[1]); // Split the URL and get the query parameters
    const environmentId = queryParams.get('state'); // Get the value of the 'state' parameter
    const code = queryParams.get('code')

    if(!environmentId){
        return NextResponse.json({"error": "Invalid environmentId"})
    }

    if (code && typeof code !== "string") {
        return NextResponse.json({ message: "`code` must be a string" }, { status: 400 });

    }

    const client_id = process.env.GOOGLE_APP_CLIENT_ID
    const client_secret = process.env.GOOGLE_APP_CLIENT_SECRET
    const redirect_uri = process.env.GOOGLE_APP_REDIRECT_URL;
    if (!client_id) return NextResponse.json({"Error":"Google client id is missing"}, { status: 400 })
    if (!client_secret) return NextResponse.json({"Error":"Google client secret is missing"}, { status: 400 })
    if (!redirect_uri) return NextResponse.json({"Error":"Google redirect url is missing"}, { status: 400 })
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

    let key = "";

    if (code) {
        const token = await oAuth2Client.getToken(code);
        key = token.res?.data;
    }
    const googleSheetIntegration = {
        type: "googleSheets" as "googleSheets",
        environment: environmentId,
        config: {
          key
        }
      }

    const result = await prisma.integration.upsert({
        where:{
            type_environmentId:{
                environmentId,
                type : "googleSheets"
            }
        },
        update: {
            ...googleSheetIntegration,
            environment: { connect: { id: environmentId } },
        },
        create:{
            ...googleSheetIntegration,
            environment: { connect: { id: environmentId } },
        }
    });

    if(result){
        return NextResponse.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/google-sheets`)
    }
}
