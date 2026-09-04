import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError, UnknownError } from "@formbricks/types/errors";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { GOOGLE_SHEET_INTEGRATION_INVALID_GRANT } from "@/lib/googleSheet/constants";

vi.mock("@/lib/integration/service", () => ({ createOrUpdateIntegration: vi.fn() }));

vi.mock("@/lib/constants", () => ({
  GOOGLE_SHEETS_CLIENT_ID: "client-id",
  GOOGLE_SHEETS_CLIENT_SECRET: "client-secret",
  GOOGLE_SHEETS_REDIRECT_URL: "https://example.com/callback",
  GOOGLE_SHEET_MESSAGE_LIMIT: 50000,
}));

const sheetsMock = vi.hoisted(() => ({
  update: vi.fn(),
  append: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    sheets: () => ({ spreadsheets: { values: sheetsMock } }),
  },
}));

const { getSpreadsheetNameById, writeData } = await import("@/lib/googleSheet/service");

/**
 * The shape the integration has once ENG-2078's redaction has blanked `config.key`: schema-valid,
 * because `ZGoogleCredential` types both tokens as `z.string()`, but unusable for auth.
 */
const redactedIntegration = {
  id: "integration1",
  type: "googleSheets",
  workspaceId: "ws1",
  config: {
    email: "owner@example.com",
    data: [],
    key: {
      scope: "https://www.googleapis.com/auth/spreadsheets",
      token_type: "Bearer",
      expiry_date: 0,
      access_token: "",
      refresh_token: "",
    },
  },
} as TIntegrationGoogleSheets;

// ENG-2303: a blank refresh token reached googleapis, which surfaced it as a bare "No refresh token is
// set." straight into a user-facing toast. It has to fail as the reconnect case instead, which the modal
// maps to a real message. Nothing here touches the network: the guard short-circuits before any Google
// call, which is also what keeps this test hermetic.
describe("getSpreadsheetNameById", () => {
  test("throws an invalid_grant AuthenticationError when the stored refresh token is blank", async () => {
    await expect(getSpreadsheetNameById(redactedIntegration, "sheet1")).rejects.toThrow(
      new AuthenticationError(GOOGLE_SHEET_INTEGRATION_INVALID_GRANT)
    );
  });
});

/** An integration whose stored access token is still valid, so `authorize` never has to refresh. */
const authorizedIntegration = {
  id: "integration1",
  type: "googleSheets",
  workspaceId: "ws1",
  config: {
    email: "owner@example.com",
    data: [],
    key: {
      scope: "https://www.googleapis.com/auth/spreadsheets",
      token_type: "Bearer",
      expiry_date: Date.now() + 60 * 60 * 1000,
      access_token: "access-token",
      refresh_token: "refresh-token",
    },
  },
} as TIntegrationGoogleSheets;

// ENG-2250: both writes used to `throw` from inside the node-style googleapis callback, so the error
// escaped `writeData`'s own `try/catch` and surfaced as an unhandled rejection while `writeData` itself
// resolved — the pipeline recorded a success and the customer's sheet quietly stopped filling up.
describe("writeData", () => {
  /**
   * googleapis never calls back on the same tick, and that is the whole bug: a synchronous callback
   * would carry the old `throw` back into `writeData`'s `try/catch` and hide it. Every mock here defers
   * like the real client does.
   */
  const respondAsync =
    (err: Error | null, onCall?: () => void) => (_params: unknown, callback: (err: Error | null) => void) => {
      setTimeout(() => {
        onCall?.();
        callback(err);
      }, 0);
    };

  beforeEach(() => {
    sheetsMock.update.mockReset();
    sheetsMock.append.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("rejects with an UnknownError when the append callback reports an error", async () => {
    sheetsMock.update.mockImplementation(respondAsync(null));
    sheetsMock.append.mockImplementation(respondAsync(new Error("The caller does not have permission")));

    await expect(writeData(authorizedIntegration, "sheet1", ["answer"], ["question"])).rejects.toThrow(
      new UnknownError("Error while appending data: The caller does not have permission")
    );
  });

  test("rejects with an UnknownError when the header update callback reports an error", async () => {
    sheetsMock.update.mockImplementation(respondAsync(new Error("Requested entity was not found")));

    await expect(writeData(authorizedIntegration, "sheet1", ["answer"], ["question"])).rejects.toThrow(
      new UnknownError("Error while appending data: Requested entity was not found")
    );
    expect(sheetsMock.append).not.toHaveBeenCalled();
  });

  test("resolves only after both writes have completed", async () => {
    const completed: string[] = [];
    sheetsMock.update.mockImplementation(respondAsync(null, () => completed.push("update")));
    sheetsMock.append.mockImplementation(respondAsync(null, () => completed.push("append")));

    await writeData(authorizedIntegration, "sheet1", ["answer"], ["question"]);

    expect(completed).toEqual(["update", "append"]);
  });
});
