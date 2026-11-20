import "server-only";
import { google } from "googleapis";
import { z } from "zod";
import { Prisma } from "@formbricks/database/prisma";
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
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES,
  GOOGLE_SHEET_INTEGRATION_INVALID_GRANT,
} from "@/lib/googleSheet/constants";
import { createOrUpdateIntegration } from "@/lib/integration/service";
import { truncateText } from "../utils/strings";
import { validateInputs } from "../utils/validate";

/**
 * ENG-2250: `sheets.spreadsheets.values.*` take a node-style callback, so a `throw` inside one escapes
 * the surrounding `try/catch` and lands as an unhandled rejection — the write fails, the sheet silently
 * stops receiving responses and the caller is never told. Wrap the call so the error rejects a promise
 * the caller awaits instead. `invoke` receives the callback rather than the method being detached, to
 * keep googleapis' own `this` binding intact.
 */
const runSheetsWrite = (invoke: (callback: (err: Error | null) => void) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    invoke((err) => {
      if (err) {
        reject(new UnknownError(`Error while appending data: ${err.message}`));
        return;
      }
      resolve();
    });
  });

/** Reads the header row (row 1) of the integration's sheet, with the same callback wrapping as the writes. */
const readHeaderRow = (
  invoke: (
    callback: (err: Error | null, res?: { data?: { values?: unknown[][] | null } } | null) => void
  ) => void
): Promise<string[]> =>
  new Promise((resolve, reject) => {
    invoke((err, res) => {
      if (err) {
        reject(new UnknownError(`Error while reading the header row: ${err.message}`));
        return;
      }
      const firstRow = res?.data?.values?.[0] ?? [];
      resolve(firstRow.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
    });
  });

/**
 * ENG-3907: the elements a response carries differ between responses (each contact's own attribute set,
 * computed variables a response never captured), so writing them positionally under a header rewritten
 * from the latest response relabels every earlier row. Instead the sheet's existing header row is kept as
 * is, labels it does not have yet are appended to its end, and each value is placed under its own label.
 * A label that occurs more than once (e.g. two questions with the same headline) is matched by occurrence:
 * the second "Name" in this response goes under the second "Name" column.
 */
export const alignRowToHeaders = (
  existingHeaders: string[],
  elements: string[],
  responses: string[]
): { headers: string[]; row: string[]; headersChanged: boolean } => {
  const headers = [...existingHeaders];
  const columnsByLabel = new Map<string, number[]>();
  headers.forEach((label, index) => {
    const columns = columnsByLabel.get(label) ?? [];
    columns.push(index);
    columnsByLabel.set(label, columns);
  });

  const occurrences = new Map<string, number>();
  const placements: { column: number; value: string }[] = [];
  elements.forEach((label, index) => {
    const occurrence = occurrences.get(label) ?? 0;
    occurrences.set(label, occurrence + 1);
    const columns = columnsByLabel.get(label) ?? [];
    let column = columns[occurrence];
    if (column === undefined) {
      column = headers.length;
      headers.push(label);
      columns.push(column);
      columnsByLabel.set(label, columns);
    }
    placements.push({ column, value: responses[index] ?? "" });
  });

  const row: string[] = new Array(headers.length).fill("");
  placements.forEach(({ column, value }) => {
    row[column] = value;
  });

  return { headers, row, headersChanged: headers.length !== existingHeaders.length };
};

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
    const truncatedResponses = responses.map((response) =>
      response.length > GOOGLE_SHEET_MESSAGE_LIMIT
        ? truncateText(response, GOOGLE_SHEET_MESSAGE_LIMIT)
        : response
    );

    const existingHeaders = await readHeaderRow((callback) =>
      sheets.spreadsheets.values.get({ spreadsheetId, range: "1:1" }, callback)
    );
    const { headers, row, headersChanged } = alignRowToHeaders(existingHeaders, elements, truncatedResponses);

    if (headersChanged) {
      await runSheetsWrite((callback) =>
        sheets.spreadsheets.values.update(
          {
            spreadsheetId: spreadsheetId,
            range: "A1",
            valueInputOption: "RAW",
            requestBody: { values: [headers] },
          },
          callback
        )
      );
    }

    await runSheetsWrite((callback) =>
      sheets.spreadsheets.values.append(
        {
          spreadsheetId: spreadsheetId,
          range: "A2",
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        },
        callback
      )
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
      sheets.spreadsheets.get(
        { spreadsheetId },
        (
          err: Error | null,
          response?: { data: { properties?: { title?: string | null } | null } } | null
        ) => {
          if (err) {
            const msg = err.message?.toLowerCase() ?? "";
            // The stored grant lacks the Sheets scope (e.g. the box was unticked on Google's consent
            // screen). Google phrases this without the word "permission", and the way out is to
            // reconnect, not to share the spreadsheet, so it gets its own code.
            const isScopeError = msg.includes("insufficient authentication scopes");
            const isPermissionError =
              msg.includes("permission") ||
              msg.includes("caller does not have") ||
              msg.includes("insufficient permission") ||
              msg.includes("access denied");
            if (isScopeError) {
              reject(new OperationNotAllowedError(GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES));
            } else if (isPermissionError) {
              reject(new OperationNotAllowedError(GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION));
            } else {
              reject(new UnknownError(`Error while fetching spreadsheet data: ${err.message}`));
            }
            return;
          }
          const spreadsheetTitle = response?.data.properties?.title;
          if (!spreadsheetTitle) {
            reject(new UnknownError("Error while fetching spreadsheet data: no title on the response"));
            return;
          }
          resolve(spreadsheetTitle);
        }
      );
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

  // Without a refresh token there is nothing to refresh, and googleapis surfaces that as a bare
  // "No refresh token is set." which reaches the user as a raw toast. Treat it as the reconnect case
  // instead, which is the only way out of it. `ZGoogleCredential` types both tokens as `z.string()`,
  // so an empty string is schema-valid and has to be checked for here.
  if (!key.refresh_token) {
    throw new AuthenticationError(GOOGLE_SHEET_INTEGRATION_INVALID_GRANT);
  }

  oAuth2Client.setCredentials({ refresh_token: key.refresh_token });

  try {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    const mergedCredentials = {
      scope: credentials.scope ?? key.scope,
      token_type: "Bearer" as const,
      expiry_date: credentials.expiry_date ?? key.expiry_date,
      access_token: credentials.access_token ?? key.access_token,
      refresh_token: credentials.refresh_token ?? key.refresh_token,
    };
    await createOrUpdateIntegration(googleSheetIntegrationData.workspaceId, {
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
