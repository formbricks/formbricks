import "server-only";
import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createCacheKey } from "@formbricks/cache";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZString } from "@formbricks/types/common";
import {
  AuthenticationError,
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import {
  TIntegrationGoogleSheets,
  ZIntegrationGoogleSheets,
} from "@formbricks/types/integration/google-sheet";
import { cache } from "@/lib/cache";
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
import { loggableError } from "@/lib/utils/loggable-error";
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

/** A, B, ... Z, AA, AB ... for a zero-based column index. */
const columnLetters = (index: number): string => {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCodePoint(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
};

/** The header row the integration writes at `A1`, e.g. `A1:E1` for five columns. */
const getHeaderRowRange = (columnCount: number): string =>
  `A1:${columnLetters(Math.max(columnCount, 1) - 1)}1`;

/**
 * The lease a holder renews every `SHEET_WRITE_LOCK_RENEW_MS` while it writes. A crashed holder stops
 * renewing, so its lock frees the sheet within this time.
 */
const SHEET_WRITE_LOCK_TTL_MS = 30_000;
const SHEET_WRITE_LOCK_RENEW_MS = 10_000;
/**
 * A holder stops writing once less than this is left of its last confirmed lease. A renewal that fails (Redis
 * unreachable) confirms nothing, so after two missed renewals the holder writes nothing more, while the lock
 * still has this long before another writer can take it.
 */
const SHEET_WRITE_LOCK_SAFETY_MS = 10_000;
/** How long a write waits for another one on the same spreadsheet before it goes ahead without the lock. */
const SHEET_WRITE_LOCK_WAIT_MS = 30_000;
const SHEET_WRITE_LOCK_POLL_MS = 200;

/** Deletes the lock only while it still holds this writer's token, so an expired lock taken over stays. */
const RELEASE_LOCK_SCRIPT = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end return 0`;
/** Extends the lease only while it still holds this writer's token; returns 0 once another writer has it. */
const RENEW_LOCK_SCRIPT = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE", KEYS[1], ARGV[2]) end return 0`;

/** Called before each sheet write; throws once this writer has lost the lock to another one. */
type TAssertLockHeld = () => void;

/** Returns when the acquired lease expires at the latest, or `null` when the write goes ahead without it. */
const acquireSpreadsheetWriteLock = async (
  lockKey: string,
  token: string,
  spreadsheetId: string
): Promise<number | null> => {
  const deadline = Date.now() + SHEET_WRITE_LOCK_WAIT_MS;
  for (;;) {
    // Taken before the request, so the lease is never assumed to run longer than it does.
    const requestedAt = Date.now();
    const locked = await cache.tryLock(lockKey, token, SHEET_WRITE_LOCK_TTL_MS);
    if (!locked.ok) {
      logger.warn({ spreadsheetId }, "Google Sheets write lock unavailable; writing without it");
      return null;
    }
    if (locked.data) return requestedAt + SHEET_WRITE_LOCK_TTL_MS;
    if (Date.now() >= deadline) {
      logger.warn(
        { spreadsheetId },
        "Timed out waiting for the Google Sheets write lock; writing without it"
      );
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, SHEET_WRITE_LOCK_POLL_MS));
  }
};

const runLockScript = (script: string, lockKey: string, args: string[]): Promise<unknown> =>
  cache.runRedisOperation((redis) => redis.eval(script, { keys: [lockKey], arguments: args }));

/**
 * ENG-3907: `writeData` reads the header row, may extend it, then appends a row placed by that header. Two
 * response-pipeline jobs writing to one spreadsheet at once (several workers or replicas) could both read
 * the same header, and the later header write would drop the label the earlier one added. The whole
 * sequence therefore runs under a Redis lock per spreadsheet, whose lease the holder renews while it
 * writes. Before each sheet write, `assertLockHeld` throws if a renewal found another writer holding the lock,
 * or if no renewal has been confirmed recently enough to leave `SHEET_WRITE_LOCK_SAFETY_MS` of the lease
 * (renewals keep failing), so a stale header snapshot is not written over another writer's. Google Sheets
 * has no conditional write, so a request already sent when the lease lapses still lands.
 * Without Redis, or after waiting `SHEET_WRITE_LOCK_WAIT_MS`, the write goes ahead unserialized: a failed
 * Sheets write is logged, not retried, so refusing would drop the response from the sheet.
 */
const withSpreadsheetWriteLock = async <T>(
  spreadsheetId: string,
  write: (assertLockHeld: TAssertLockHeld) => Promise<T>
): Promise<T> => {
  const lockKey = createCacheKey.integration.googleSheetWriteLock(spreadsheetId);
  const token = randomUUID();
  const acquiredLeaseEnd = await acquireSpreadsheetWriteLock(lockKey, token, spreadsheetId);
  if (acquiredLeaseEnd === null) return await write(() => {});

  let leaseEnd = acquiredLeaseEnd;
  let lost = false;
  const renewal = setInterval(() => {
    const requestedAt = Date.now();
    runLockScript(RENEW_LOCK_SCRIPT, lockKey, [token, String(SHEET_WRITE_LOCK_TTL_MS)])
      .then((renewed) => {
        if (renewed === 1) leaseEnd = Math.max(leaseEnd, requestedAt + SHEET_WRITE_LOCK_TTL_MS);
        else lost = true;
      })
      .catch((error: unknown) => {
        // Confirms nothing: the lease keeps its last known end, which assertLockHeld checks.
        logger.warn(
          { error: loggableError(error), spreadsheetId },
          "Could not renew the Google Sheets write lock"
        );
      });
  }, SHEET_WRITE_LOCK_RENEW_MS);
  renewal.unref?.();

  const assertLockHeld: TAssertLockHeld = () => {
    if (lost) {
      throw new UnknownError("Lost the Google Sheets write lock to another writer; nothing more was written");
    }
    if (Date.now() >= leaseEnd - SHEET_WRITE_LOCK_SAFETY_MS) {
      throw new UnknownError(
        "Could not renew the Google Sheets write lock in time; nothing more was written"
      );
    }
  };

  try {
    return await write(assertLockHeld);
  } finally {
    clearInterval(renewal);
    try {
      await runLockScript(RELEASE_LOCK_SCRIPT, lockKey, [token]);
    } catch (error) {
      // The lock expires on its own after SHEET_WRITE_LOCK_TTL_MS; the write's outcome stands.
      logger.warn(
        { error: loggableError(error), spreadsheetId },
        "Could not release the Google Sheets write lock"
      );
    }
  }
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

    await withSpreadsheetWriteLock(spreadsheetId, async (assertLockHeld) => {
      const existingHeaders = await readHeaderRow((callback) =>
        sheets.spreadsheets.values.get({ spreadsheetId, range: "1:1" }, callback)
      );
      const { headers, row, headersChanged } = alignRowToHeaders(
        existingHeaders,
        elements,
        truncatedResponses
      );

      if (headersChanged) {
        assertLockHeld();
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

      // ENG-4050: `append` looks for the "table" at `range` and writes below its last row. Anchored on
      // `A2`, a response whose first answer was empty (e.g. a Statement / CTA first) left `A2` blank, so
      // the next append found no table there and wrote over row 2 — the sheet only ever kept the latest
      // response. The header row, kept or just written above, always carries the table, so anchor on it.
      assertLockHeld();
      await runSheetsWrite((callback) =>
        sheets.spreadsheets.values.append(
          {
            spreadsheetId: spreadsheetId,
            range: getHeaderRowRange(headers.length),
            valueInputOption: "RAW",
            requestBody: { values: [row] },
          },
          callback
        )
      );
    });
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

/** The HTTP status Google answered with, from a googleapis (gaxios) error. */
const getGoogleHttpStatus = (error: unknown): number | undefined => {
  const { status, response } = error as { status?: unknown; response?: { status?: unknown } };
  if (typeof status === "number") return status;
  return typeof response?.status === "number" ? response.status : undefined;
};

/**
 * A spreadsheet's title. Rejects with a `ResourceNotFoundError` when Google knows no spreadsheet by that
 * id, an `OperationNotAllowedError` when the grant can't open it, and an `UnknownError` when Google fails.
 */
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
            if (getGoogleHttpStatus(err) === 404) {
              reject(new ResourceNotFoundError("Spreadsheet", spreadsheetId));
            } else if (isScopeError) {
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
