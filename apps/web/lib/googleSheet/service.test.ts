import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError, OperationNotAllowedError, UnknownError } from "@formbricks/types/errors";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import {
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION,
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES,
  GOOGLE_SHEET_INTEGRATION_INVALID_GRANT,
} from "@/lib/googleSheet/constants";

vi.mock("@/lib/integration/service", () => ({ createOrUpdateIntegration: vi.fn() }));

vi.mock("@/lib/constants", () => ({
  GOOGLE_SHEETS_CLIENT_ID: "client-id",
  GOOGLE_SHEETS_CLIENT_SECRET: "client-secret",
  GOOGLE_SHEETS_REDIRECT_URL: "https://example.com/callback",
  GOOGLE_SHEET_MESSAGE_LIMIT: 50000,
}));

const sheetsMock = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  append: vi.fn(),
}));

const spreadsheetsGetMock = vi.hoisted(() => vi.fn());

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    sheets: () => ({ spreadsheets: { values: sheetsMock, get: spreadsheetsGetMock } }),
  },
}));

const { alignRowToHeaders, getSpreadsheetNameById, writeData } = await import("@/lib/googleSheet/service");

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

  // ENG-2807: Google's scope rejection never says "permission", so it slipped past the permission guard
  // and reached the user as a raw English Google string. It needs its own code, because the fix is to
  // reconnect and grant the Sheets scope, not to share the spreadsheet.
  describe("when Google rejects the spreadsheet fetch", () => {
    const rejectWith = (message: string) => {
      spreadsheetsGetMock.mockImplementation((_params, callback: (err: Error | null) => void) => {
        setTimeout(() => callback(new Error(message)), 0);
      });
    };

    beforeEach(() => {
      spreadsheetsGetMock.mockReset();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    test("maps a missing OAuth scope to the insufficient_scopes code", async () => {
      rejectWith("Request had insufficient authentication scopes.");

      await expect(getSpreadsheetNameById(authorizedIntegration, "sheet1")).rejects.toThrow(
        new OperationNotAllowedError(GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES)
      );
    });

    test("keeps mapping a sharing problem to the insufficient_permission code", async () => {
      rejectWith("The caller does not have permission");

      await expect(getSpreadsheetNameById(authorizedIntegration, "sheet1")).rejects.toThrow(
        new OperationNotAllowedError(GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION)
      );
    });

    test("wraps any other Google error in an UnknownError", async () => {
      rejectWith("Requested entity was not found.");

      await expect(getSpreadsheetNameById(authorizedIntegration, "sheet1")).rejects.toThrow(UnknownError);
    });
  });
});

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

  /** An empty sheet: the header row read returns no values. */
  const emptyHeaderRow = (
    _params: unknown,
    callback: (err: Error | null, res?: { data: { values?: string[][] } }) => void
  ) => {
    setTimeout(() => callback(null, { data: {} }), 0);
  };

  beforeEach(() => {
    sheetsMock.get.mockReset();
    sheetsMock.update.mockReset();
    sheetsMock.append.mockReset();
    sheetsMock.get.mockImplementation(emptyHeaderRow);
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

  test("rejects with an UnknownError when reading the header row fails, without writing", async () => {
    sheetsMock.get.mockImplementation((_params: unknown, callback: (err: Error | null) => void) => {
      setTimeout(() => callback(new Error("Requested entity was not found")), 0);
    });

    await expect(writeData(authorizedIntegration, "sheet1", ["answer"], ["question"])).rejects.toThrow(
      new UnknownError("Error while reading the header row: Requested entity was not found")
    );
    expect(sheetsMock.update).not.toHaveBeenCalled();
    expect(sheetsMock.append).not.toHaveBeenCalled();
  });

  // ENG-3907: each response used to rewrite row 1 with its own labels and append its values by position,
  // so a later contact with a different attribute set relabelled every earlier row.
  describe("keeps every row aligned with its column headers", () => {
    /** An in-memory spreadsheet behind the get/update/append mocks. */
    const useFakeSheet = () => {
      const sheet: string[][] = [];
      sheetsMock.get.mockImplementation(
        (
          _params: unknown,
          callback: (err: Error | null, res?: { data: { values?: string[][] } }) => void
        ) => {
          setTimeout(() => callback(null, { data: sheet[0] ? { values: [[...sheet[0]]] } : {} }), 0);
        }
      );
      sheetsMock.update.mockImplementation(
        (params: { requestBody: { values: string[][] } }, callback: (err: Error | null) => void) => {
          setTimeout(() => {
            sheet[0] = [...params.requestBody.values[0]];
            callback(null);
          }, 0);
        }
      );
      sheetsMock.append.mockImplementation(
        (params: { requestBody: { values: string[][] } }, callback: (err: Error | null) => void) => {
          setTimeout(() => {
            if (sheet.length === 0) sheet.push([]);
            sheet.push([...params.requestBody.values[0]]);
            callback(null);
          }, 0);
        }
      );
      return sheet;
    };

    /** Reads the sheet back as one label → value record per response row. */
    const asRecords = (sheet: string[][]) =>
      sheet
        .slice(1)
        .map((row) =>
          Object.fromEntries(
            sheet[0].map((label, index) => [label, row[index] ?? ""]).filter(([, value]) => value !== "")
          )
        );

    test("two contacts with different attribute sets and order keep their own values", async () => {
      const sheet = useFakeSheet();

      await writeData(
        authorizedIntegration,
        "sheet1",
        ["Great", "pro", "a@example.com"],
        ["How was it?", "person.plan", "person.email"]
      );
      await writeData(
        authorizedIntegration,
        "sheet1",
        ["Okay", "b@example.com", "Acme", "free"],
        ["How was it?", "person.email", "person.company", "person.plan"]
      );

      expect(sheet[0]).toEqual(["How was it?", "person.plan", "person.email", "person.company"]);
      expect(asRecords(sheet)).toEqual([
        { "How was it?": "Great", "person.plan": "pro", "person.email": "a@example.com" },
        {
          "How was it?": "Okay",
          "person.plan": "free",
          "person.email": "b@example.com",
          "person.company": "Acme",
        },
      ]);
    });

    test("a response missing a computed variable or attributes leaves those cells empty", async () => {
      const sheet = useFakeSheet();

      await writeData(
        authorizedIntegration,
        "sheet1",
        ["Great", "42", "2026-01-01", "a@example.com"],
        ["How was it?", "score", "Created At", "person.email"]
      );
      // An anonymous, API-created response: no captured `score`, no contact attributes.
      await writeData(authorizedIntegration, "sheet1", ["Bad", "2026-01-02"], ["How was it?", "Created At"]);

      expect(sheet[0]).toEqual(["How was it?", "score", "Created At", "person.email"]);
      expect(sheet[2]).toEqual(["Bad", "", "2026-01-02", ""]);
      expect(asRecords(sheet)[0]).toEqual({
        "How was it?": "Great",
        score: "42",
        "Created At": "2026-01-01",
        "person.email": "a@example.com",
      });
    });

    test("does not rewrite the header row when it already covers every label", async () => {
      sheetsMock.get.mockImplementation(
        (
          _params: unknown,
          callback: (err: Error | null, res?: { data: { values?: string[][] } }) => void
        ) => {
          setTimeout(() => callback(null, { data: { values: [["Q1", "Q2"]] } }), 0);
        }
      );
      sheetsMock.append.mockImplementation(respondAsync(null));

      await writeData(authorizedIntegration, "sheet1", ["b", "a"], ["Q2", "Q1"]);

      expect(sheetsMock.update).not.toHaveBeenCalled();
      expect(sheetsMock.append).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: { values: [["a", "b"]] } }),
        expect.any(Function)
      );
    });
  });
});

describe("alignRowToHeaders", () => {
  test("matches a repeated label by occurrence", () => {
    expect(alignRowToHeaders(["Name", "Name"], ["Name", "Name"], ["first", "second"])).toEqual({
      headers: ["Name", "Name"],
      row: ["first", "second"],
      headersChanged: false,
    });
  });

  test("appends a further occurrence of a known label as a new column", () => {
    expect(alignRowToHeaders(["Name"], ["Name", "Name"], ["first", "second"])).toEqual({
      headers: ["Name", "Name"],
      row: ["first", "second"],
      headersChanged: true,
    });
  });

  test("writes the response's own labels as the header on an empty sheet", () => {
    expect(alignRowToHeaders([], ["Q1", "Q2"], ["a", "b"])).toEqual({
      headers: ["Q1", "Q2"],
      row: ["a", "b"],
      headersChanged: true,
    });
  });
});
