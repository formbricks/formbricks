import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ZString } from "@formbricks/types/common";
import {
  AuthenticationError,
  DatabaseError,
  OperationNotAllowedError,
  UnknownError,
} from "@formbricks/types/errors";
import {
  TIntegrationGoogleSheets,
  ZIntegrationGoogleSheets,
} from "@formbricks/types/integration/google-sheet";
import {
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  GOOGLE_SHEET_MESSAGE_LIMIT,
} from "@/lib/constants";
import {
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION,
  GOOGLE_SHEET_INTEGRATION_INVALID_GRANT,
} from "@/lib/googleSheet/constants";
import { createOrUpdateIntegration } from "@/lib/integration/service";
import { truncateText } from "../utils/strings";
import { validateInputs } from "../utils/validate";

const { google } = require("googleapis");

export const writeData = async (
  integrationData: TIntegrationGoogleSheets,
  spreadsheetId: string,
  responses: string[],
  elements: string[]
) => {
  validateInputs(
    [integrationData, ZIntegrationGoogleSheets],
    [spreadsheetId, ZString],
    [responses, z.array(ZString)],
    [elements, z.array(ZString)]
  );

  try {
    const authClient = await authorize(integrationData);
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const responsesMapped = {
      values: [
        responses.map((response) =>
          response.length > GOOGLE_SHEET_MESSAGE_LIMIT
            ? truncateText(response, GOOGLE_SHEET_MESSAGE_LIMIT)
            : response
        ),
      ],
    };

    const element = { values: [elements] };
    sheets.spreadsheets.values.update(
      {
        spreadsheetId: spreadsheetId,
        range: "A1",
        valueInputOption: "RAW",
        resource: element,
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
        resource: responsesMapped,
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

export const validateGoogleSheetsConnection = async (
  googleSheetIntegrationData: TIntegrationGoogleSheets
): Promise<void> => {
  validateInputs([googleSheetIntegrationData, ZIntegrationGoogleSheets]);
  const integrationData = structuredClone(googleSheetIntegrationData);
  integrationData.config.data.forEach((data) => {
    data.createdAt = new Date(data.createdAt);
  });
  await authorize(integrationData);
};

export const getSpreadsheetNameById = async (
  googleSheetIntegrationData: TIntegrationGoogleSheets,
  spreadsheetId: string
): Promise<string> => {
  validateInputs([googleSheetIntegrationData, ZIntegrationGoogleSheets]);

  try {
    const authClient = await authorize(googleSheetIntegrationData);
    const sheets = google.sheets({ version: "v4", auth: authClient });

    return new Promise((resolve, reject) => {
      sheets.spreadsheets.get({ spreadsheetId }, (err, response) => {
        if (err) {
          const msg = err.message?.toLowerCase() ?? "";
          const isPermissionError =
            msg.includes("permission") ||
            msg.includes("caller does not have") ||
            msg.includes("insufficient permission") ||
            msg.includes("access denied");
          if (isPermissionError) {
            reject(new OperationNotAllowedError(GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION));
          } else {
            reject(new UnknownError(`Error while fetching spreadsheet data: ${err.message}`));
          }
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

const isInvalidGrantError = (error: unknown): boolean => {
  const err = error as { message?: string; response?: { data?: { error?: string } } };
  return (
    typeof err?.message === "string" &&
    err.message.toLowerCase().includes(GOOGLE_SHEET_INTEGRATION_INVALID_GRANT)
  );
};

/** Buffer in ms before expiry_date to consider token near-expired (5 minutes). */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v1/tokeninfo";

/**
 * Verifies that the access token is still valid and not revoked (e.g. user removed app access).
 * Returns true if token is valid, false if invalid/revoked.
 */
const isAccessTokenValid = async (accessToken: string): Promise<boolean> => {
  try {
    const res = await fetch(`${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
    return res.ok;
  } catch {
    return false;
  }
};

const authorize = async (googleSheetIntegrationData: TIntegrationGoogleSheets) => {
  const client_id = GOOGLE_SHEETS_CLIENT_ID;
  const client_secret = GOOGLE_SHEETS_CLIENT_SECRET;
  const redirect_uri = GOOGLE_SHEETS_REDIRECT_URL;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  const key = googleSheetIntegrationData.config.key;

  const hasStoredCredentials =
    key.access_token && key.expiry_date && key.expiry_date > Date.now() + TOKEN_EXPIRY_BUFFER_MS;

  if (hasStoredCredentials && (await isAccessTokenValid(key.access_token))) {
    oAuth2Client.setCredentials(key);
    return oAuth2Client;
  }

  oAuth2Client.setCredentials({ refresh_token: key.refresh_token });

  try {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    const mergedCredentials = {
      ...credentials,
      refresh_token: credentials.refresh_token ?? key.refresh_token,
    };
    await createOrUpdateIntegration(googleSheetIntegrationData.environmentId, {
      type: "googleSheets",
      config: {
        data: googleSheetIntegrationData.config?.data ?? [],
        email: googleSheetIntegrationData.config?.email ?? "",
        key: mergedCredentials,
      },
    });

    oAuth2Client.setCredentials(mergedCredentials);
    return oAuth2Client;
  } catch (error) {
    if (isInvalidGrantError(error)) {
      throw new AuthenticationError(GOOGLE_SHEET_INTEGRATION_INVALID_GRANT);
    }
    throw error;
  }
};
