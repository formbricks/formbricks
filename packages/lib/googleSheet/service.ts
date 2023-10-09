import "server-only";

import { z } from "zod";
import { validateInputs } from "../utils/validate";
import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { DatabaseError, UnknownError } from "@formbricks/types/v1/errors";
import { ZId } from "@formbricks/types/v1/environment";
import {
  ZGoogleCredential,
  TGoogleCredential,
  TGoogleSpreadsheet,
  TIntegration,
  TGoogleSheetIntegration,
} from "@formbricks/types/v1/integrations";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "../constants";
import { ZString } from "@formbricks/types/v1/common";

const { google } = require("googleapis");

async function fetchSpreadsheets(auth: any) {
  const authClient = authorize(auth);
  const service = google.drive({ version: "v3", auth: authClient });
  try {
    const res = await service.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'  AND trashed=false",
      fields: "nextPageToken, files(id, name)",
    });
    return res.data.files;
  } catch (err) {
    throw err;
  }
}

export const getGoogleSheetIntegration = async (
  environmentId: string
): Promise<TIntegration | TGoogleSheetIntegration | null> => {
  validateInputs([environmentId, ZId]);

  try {
    const result = await prisma.integration.findUnique({
      where: {
        type_environmentId: {
          environmentId,
          type: "googleSheets",
        },
      },
    });

    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};

export const getSpreadSheets = async (environmentId: string): Promise<TGoogleSpreadsheet[]> => {
  validateInputs([environmentId, ZId]);

  let spreadsheets: TGoogleSpreadsheet[] = [];
  try {
    const googleIntegration = (await getGoogleSheetIntegration(environmentId)) as TGoogleSheetIntegration;
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
};
export async function writeData(credentials: TGoogleCredential, spreadsheetId: string, values: string[][]) {
  validateInputs(
    [credentials, ZGoogleCredential],
    [spreadsheetId, ZString],
    [values, z.array(z.array(ZString))]
  );

  try {
    const authClient = authorize(credentials);
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const responses = { values: [values[0]] };
    const question = { values: [values[1]] };
    sheets.spreadsheets.values.update(
      {
        spreadsheetId: spreadsheetId,
        range: "A1",
        valueInputOption: "RAW",
        resource: question,
      },
      (err: Error) => {
        if (err) {
          throw new UnknownError(`Error while appending data: ${err.message}`);
        }
      }
    );

    sheets.spreadsheets.values.append(
      {
        spreadsheetId: spreadsheetId,
        range: "A2",
        valueInputOption: "RAW",
        resource: responses,
      },
      (err: Error) => {
        if (err) {
          throw new UnknownError(`Error while appending data: ${err.message}`);
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
  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  oAuth2Client.setCredentials(credentials);

  return oAuth2Client;
};
