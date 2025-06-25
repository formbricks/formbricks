import { responses } from "@/app/lib/api/response";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@/lib/constants";
import { createOrUpdateIntegration } from "@/lib/integration/service";
import { google } from "googleapis";

export const GET = async (req: Request) => {
  const url = req.url;
  const queryParams = new URLSearchParams(url.split("?")[1]); // Split the URL and get the query parameters
  const environmentId = queryParams.get("state"); // Get the value of the 'state' parameter
  const code = queryParams.get("code");

  if (!environmentId) {
    return responses.badRequestResponse("Invalid environmentId");
  }

  if (code && typeof code !== "string") {
    return responses.badRequestResponse("`code` must be a string");
  }

  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;
  if (!client_id) return responses.internalServerErrorResponse("Google client id is missing");
  if (!client_secret) return responses.internalServerErrorResponse("Google client secret is missing");
  if (!redirect_uri) return responses.internalServerErrorResponse("Google redirect url is missing");
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

  const result = await createOrUpdateIntegration(environmentId, googleSheetIntegration);

  if (result) {
    return Response.redirect(`${WEBAPP_URL}/environments/${environmentId}/integrations/google-sheets`);
  }
};
