
import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "@formbricks/errors";
import { cache } from "react";
import { TGoogleCredential, TGoogleSheetIntegration, TGoogleSpreadsheet } from "@formbricks/types/v1/integrations";

const { google } = require('googleapis');

async function fetchSpreadsheets(auth: any) {

  const authClient = authorize(auth)
  const service = google.drive({ version: 'v3', auth: authClient });
  try {
    const res = await service.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'  AND trashed=false",
      fields: 'nextPageToken, files(id, name)'
    });
    return res.data.files;
  } catch (err) {
    throw err;
  }
}

export const getSpreadSheets = cache(async (environmentId: string) : Promise<TGoogleSpreadsheet[]> => {
  let spreadsheets = [];
  try {
    const googleIntegration : TGoogleSheetIntegration | null = await prisma.integration.findUnique({
      where: {
        type_environmentId: {
          environmentId,
          type: "googleSheets"
        }
      }
    });
    if (googleIntegration && googleIntegration.config?.key) {
      spreadsheets = await fetchSpreadsheets(googleIntegration.config?.key);
    }
    return spreadsheets;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
})
export async function writeData(credentials: TGoogleCredential, spreadsheetId: string, values: any) {
  try {
    const authClient = authorize(credentials);
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const resource = {
      values,
    };

    sheets.spreadsheets.values.append(
      {
        spreadsheetId: spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        resource: resource,
      },
      (err : Error, result: any) => {
        if (err) {
          throw new Error(`Error while appending data: ${err.message}`);
        } else {
          
        }
      }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
}



const authorize = (credentials: any) => {
  const client_id = process.env.GOOGLE_APP_CLIENT_ID
  const client_secret = process.env.GOOGLE_APP_CLIENT_SECRET
  const redirect_uri = process.env.GOOGLE_APP_REDIRECT_URL;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uri
  );
  oAuth2Client.setCredentials(
    credentials
  );

  return oAuth2Client;
};