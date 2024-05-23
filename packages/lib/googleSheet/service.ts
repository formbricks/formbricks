import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import {
  TIntegrationGoogleSheetsCredential,
  ZIntegrationGoogleSheetsCredential,
} from "@formbricks/types/integration/googleSheet";

import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
} from "../constants";
import { validateInputs } from "../utils/validate";

const { google } = require("googleapis");

export const writeData = async (
  credentials: TIntegrationGoogleSheetsCredential,
  spreadsheetId: string,
  values: string[][]
) => {
  validateInputs(
    [credentials, ZIntegrationGoogleSheetsCredential],
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
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getSpreadsheetNameById = async (
  credentials: TIntegrationGoogleSheetsCredential,
  spreadsheetId: string
): Promise<string> => {
  validateInputs([credentials, ZIntegrationGoogleSheetsCredential]);

  try {
    const authClient = authorize(credentials);
    const sheets = google.sheets({ version: "v4", auth: authClient });

    return new Promise((resolve, reject) => {
      sheets.spreadsheets.get({ spreadsheetId }, (err, response) => {
        if (err) {
          reject(new UnknownError(`Error while fetching spreadsheet data: ${err.message}`));
          return;
        }
        const spreadsheetTitle = response.data.properties.title;
        resolve(spreadsheetTitle);
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

const authorize = (credentials: any) => {
  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  oAuth2Client.setCredentials(credentials);

  return oAuth2Client;
};
