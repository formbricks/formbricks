import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthenticationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import {
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_PERMISSION,
  GOOGLE_SHEET_INTEGRATION_INSUFFICIENT_SCOPES,
  GOOGLE_SHEET_INTEGRATION_INVALID_GRANT,
} from "@/lib/googleSheet/constants";

vi.mock("@/lib/integration/service", () => ({ createOrUpdateIntegration: vi.fn() }));

/**
 * An in-memory stand-in for the Redis locks `writeData` takes per spreadsheet. A lock with an entry in
 * `lockExpiresAt` lapses at that `Date.now()`; one set without it (another writer's, in a test) never does.
 */
const lockStore = vi.hoisted(() => new Map<string, string>());
const lockExpiresAt = vi.hoisted(() => new Map<string, number>());
/** While true, every lease renewal fails as if Redis were unreachable. */
const renewalsFail = vi.hoisted(() => ({ current: false }));
const cacheMock = vi.hoisted(() => {
  const liveLock = (key: string) => {
    const expiresAt = lockExpiresAt.get(key);
    if (expiresAt !== undefined && Date.now() >= expiresAt) {
      lockStore.delete(key);
      lockExpiresAt.delete(key);
    }
    return lockStore.get(key);
  };
  return {
    tryLock: vi.fn(
      async (
        key: string,
        value: string,
        ttlMs: number
      ): Promise<{ ok: true; data: boolean } | { ok: false; error: { code: string } }> => {
        if (liveLock(key) !== undefined) return { ok: true, data: false };
        lockStore.set(key, value);
        lockExpiresAt.set(key, Date.now() + ttlMs);
        return { ok: true, data: true };
      }
    ),
    runRedisOperation: vi.fn(async (operation: (redis: unknown) => Promise<unknown>) =>
      operation({
        // The two token-checked scripts the service runs: PEXPIRE renews the lease, otherwise DEL releases it.
        eval: async (script: string, options: { keys: string[]; arguments: string[] }) => {
          const [key] = options.keys;
          const renewing = script.includes("PEXPIRE");
          if (renewing && renewalsFail.current) throw new Error("Connection is closed.");
          if (liveLock(key) !== options.arguments[0]) return 0;
          if (renewing) {
            lockExpiresAt.set(key, Date.now() + Number(options.arguments[1]));
            return 1;
          }
          lockStore.delete(key);
          lockExpiresAt.delete(key);
          return 1;
        },
      })
    ),
  };
});
vi.mock("@/lib/cache", () => ({ cache: cacheMock }));

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

    // A mistyped or deleted spreadsheet is the caller's to fix, not a Google failure.
    test("rejects with a ResourceNotFoundError when Google answers 404", async () => {
      spreadsheetsGetMock.mockImplementation((_params, callback: (err: Error | null) => void) => {
        setTimeout(
          () => callback(Object.assign(new Error("Requested entity was not found."), { status: 404 })),
          0
        );
      });

      await expect(getSpreadsheetNameById(authorizedIntegration, "missing-sheet")).rejects.toThrow(
        new ResourceNotFoundError("Spreadsheet", "missing-sheet")
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
    lockStore.clear();
    lockExpiresAt.clear();
    renewalsFail.current = false;
    cacheMock.tryLock.mockClear();
    cacheMock.runRedisOperation.mockClear();
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

  /**
   * ENG-4050: a minimal model of the Sheets API. `update` writes cells at the range's top-left cell;
   * `append` follows Google's documented rule — find the table at the range and write below its last
   * row — and, like Google, writes AT the range when no cell there holds a value. Driven through
   * `writeData`, it shows whether consecutive responses survive as separate rows.
   */
  const createFakeSheet = () => {
    const rows: string[][] = [];
    const parseRange = (range: string) => {
      const [, startColumn, startRow, endColumn = startColumn] =
        /^([A-Z]+)(\d+)(?::([A-Z]+)\d+)?$/.exec(range) ?? [];
      const toIndex = (letters: string) =>
        [...letters].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      return { row: Number(startRow) - 1, firstColumn: toIndex(startColumn), lastColumn: toIndex(endColumn) };
    };
    const rowHasValue = (row: number, from = 0, to = Infinity) =>
      (rows[row] ?? []).some((cell, column) => column >= from && column <= to && cell !== "");
    const writeRow = (row: number, values: string[]) => {
      rows[row] = values;
    };

    sheetsMock.get.mockImplementation(
      (_params: unknown, callback: (err: null, res: { data: { values?: string[][] } }) => void) => {
        const header = rows[0];
        setTimeout(() => callback(null, { data: header ? { values: [[...header]] } : {} }), 0);
      }
    );
    sheetsMock.update.mockImplementation(
      (params: { range: string; requestBody: { values: string[][] } }, callback: (err: null) => void) => {
        writeRow(parseRange(params.range).row, params.requestBody.values[0]);
        setTimeout(() => callback(null), 0);
      }
    );
    sheetsMock.append.mockImplementation(
      (params: { range: string; requestBody: { values: string[][] } }, callback: (err: null) => void) => {
        const { row, firstColumn, lastColumn } = parseRange(params.range);
        let target = row;
        if (rowHasValue(row, firstColumn, lastColumn)) {
          while (rowHasValue(target)) target++;
        }
        writeRow(target, params.requestBody.values[0]);
        setTimeout(() => callback(null), 0);
      }
    );

    return rows;
  };

  test("keeps every response as its own row when the first answer is empty", async () => {
    const rows = createFakeSheet();
    const header = ["Welcome (CTA)", "How did you hear about us?", "Rating"];

    await writeData(authorizedIntegration, "sheet1", ["", "Friend", "5"], header);
    await writeData(authorizedIntegration, "sheet1", ["", "Search", "3"], header);
    await writeData(authorizedIntegration, "sheet1", ["", "Ad", "4"], header);

    expect(rows).toEqual([header, ["", "Friend", "5"], ["", "Search", "3"], ["", "Ad", "4"]]);
  });

  test("keeps appending below earlier rows when only some responses start empty", async () => {
    const rows = createFakeSheet();
    const header = ["Question 1", "Question 2"];

    await writeData(authorizedIntegration, "sheet1", ["a", "b"], header);
    await writeData(authorizedIntegration, "sheet1", ["", "c"], header);
    await writeData(authorizedIntegration, "sheet1", ["d", "e"], header);

    expect(rows).toEqual([header, ["a", "b"], ["", "c"], ["d", "e"]]);
  });

  test("anchors the append on the header row the integration writes", async () => {
    createFakeSheet();
    const header = Array.from({ length: 28 }, (_, index) => `Column ${index + 1}`);

    await writeData(authorizedIntegration, "sheet1", Array(28).fill("x"), header);

    expect(sheetsMock.update.mock.calls[0][0]).toMatchObject({ range: "A1" });
    expect(sheetsMock.append.mock.calls[0][0]).toMatchObject({ range: "A1:AB1" });
  });

  test("anchors the append on the full header row when it is wider than the response", async () => {
    const rows = createFakeSheet();
    const header = Array.from({ length: 28 }, (_, index) => `Column ${index + 1}`);

    await writeData(authorizedIntegration, "sheet1", Array(28).fill("x"), header);
    await writeData(authorizedIntegration, "sheet1", ["", "y"], ["Column 1", "Column 2"]);

    expect(sheetsMock.update).toHaveBeenCalledTimes(1);
    expect(sheetsMock.append.mock.calls[1][0]).toMatchObject({ range: "A1:AB1" });
    expect(rows[2]).toEqual(["", "y", ...Array(26).fill("")]);
  });
  // ENG-3907: the header read, header write and append run as one sequence per spreadsheet, so two jobs
  // on different workers cannot both extend the header from the same read.
  describe("serializes writes to one spreadsheet", () => {
    const lockKey = "fb:integration:google-sheets:sheet1:write-lock";

    test("holds the spreadsheet's lock across the read and both writes, then releases it", async () => {
      const lockHeldDuring: string[] = [];
      const record = (step: string) => () => {
        if (lockStore.has(lockKey)) lockHeldDuring.push(step);
      };
      sheetsMock.get.mockImplementation(
        (_params: unknown, callback: (err: null, res: { data: object }) => void) => {
          record("get")();
          setTimeout(() => callback(null, { data: {} }), 0);
        }
      );
      sheetsMock.update.mockImplementation(respondAsync(null, record("update")));
      sheetsMock.append.mockImplementation(respondAsync(null, record("append")));

      await writeData(authorizedIntegration, "sheet1", ["answer"], ["question"]);

      expect(lockHeldDuring).toEqual(["get", "update", "append"]);
      expect(lockStore.has(lockKey)).toBe(false);
    });

    test("two concurrent writes with new labels both keep their columns", async () => {
      const sheet: string[][] = [["Q1"]];
      sheetsMock.get.mockImplementation(
        (_params: unknown, callback: (err: null, res: { data: { values: string[][] } }) => void) => {
          const header = [...sheet[0]];
          setTimeout(() => callback(null, { data: { values: [header] } }), 5);
        }
      );
      sheetsMock.update.mockImplementation(
        (params: { requestBody: { values: string[][] } }, callback: (err: null) => void) => {
          setTimeout(() => {
            sheet[0] = [...params.requestBody.values[0]];
            callback(null);
          }, 5);
        }
      );
      sheetsMock.append.mockImplementation(
        (params: { requestBody: { values: string[][] } }, callback: (err: null) => void) => {
          setTimeout(() => {
            sheet.push([...params.requestBody.values[0]]);
            callback(null);
          }, 5);
        }
      );

      await Promise.all([
        writeData(authorizedIntegration, "sheet1", ["a", "plan-a"], ["Q1", "person.plan"]),
        writeData(authorizedIntegration, "sheet1", ["b", "acme"], ["Q1", "person.company"]),
      ]);

      expect(sheet[0]).toEqual(["Q1", "person.plan", "person.company"]);
      expect(sheet.slice(1)).toEqual([
        ["a", "plan-a"],
        ["b", "", "acme"],
      ]);
    });

    test("releases the lock when a write fails", async () => {
      sheetsMock.update.mockImplementation(respondAsync(new Error("Requested entity was not found")));

      await expect(writeData(authorizedIntegration, "sheet1", ["answer"], ["question"])).rejects.toThrow(
        UnknownError
      );
      expect(lockStore.has(lockKey)).toBe(false);
    });

    describe("while a write outlasts the renewal interval", () => {
      beforeEach(() => {
        // The service's own setTimeout calls stay real; the clock and the renewal interval are faked.
        vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      /** Header read that runs `during` (the clock is free to move there), then answers with an empty sheet. */
      const slowHeaderRead =
        (during: () => Promise<void> | void) =>
        (_params: unknown, callback: (err: null, res: { data: object }) => void) => {
          void Promise.resolve(during()).then(() => callback(null, { data: {} }));
        };

      test("keeps the lock past the original 30 s lease while renewals succeed", async () => {
        let otherWriterGotLock: boolean | undefined;
        sheetsMock.get.mockImplementation(
          slowHeaderRead(async () => {
            await vi.advanceTimersByTimeAsync(45_000);
            const attempt = await cacheMock.tryLock(lockKey, "other-writer", 30_000);
            otherWriterGotLock = attempt.ok && attempt.data;
          })
        );
        sheetsMock.update.mockImplementation(respondAsync(null));
        sheetsMock.append.mockImplementation(respondAsync(null));

        await writeData(authorizedIntegration, "sheet1", ["answer"], ["question"]);

        expect(otherWriterGotLock).toBe(false);
        expect(sheetsMock.update).toHaveBeenCalledTimes(1);
        expect(sheetsMock.append).toHaveBeenCalledTimes(1);
        expect(lockStore.has(lockKey)).toBe(false);
      });

      test("writes nothing once renewals have failed for most of the lease", async () => {
        sheetsMock.get.mockImplementation(
          slowHeaderRead(async () => {
            renewalsFail.current = true;
            await vi.advanceTimersByTimeAsync(20_000);
          })
        );
        sheetsMock.update.mockImplementation(respondAsync(null));
        sheetsMock.append.mockImplementation(respondAsync(null));

        await expect(writeData(authorizedIntegration, "sheet1", ["answer"], ["question"])).rejects.toThrow(
          new UnknownError("Could not renew the Google Sheets write lock in time; nothing more was written")
        );
        expect(sheetsMock.update).not.toHaveBeenCalled();
        expect(sheetsMock.append).not.toHaveBeenCalled();
        // The lease had not lapsed yet, so the release still frees the sheet.
        expect(lockStore.has(lockKey)).toBe(false);
      });

      test("writes nothing once another writer has taken the lapsed lock", async () => {
        // The lease lapsed during the read and another writer took the lock.
        sheetsMock.get.mockImplementation(
          slowHeaderRead(async () => {
            lockStore.set(lockKey, "other-writer");
            lockExpiresAt.delete(lockKey);
            await vi.advanceTimersByTimeAsync(10_000);
          })
        );

        await expect(writeData(authorizedIntegration, "sheet1", ["answer"], ["question"])).rejects.toThrow(
          new UnknownError("Lost the Google Sheets write lock to another writer; nothing more was written")
        );
        expect(sheetsMock.update).not.toHaveBeenCalled();
        expect(sheetsMock.append).not.toHaveBeenCalled();
        expect(lockStore.get(lockKey)).toBe("other-writer");
      });
    });

    test("still writes when Redis is unavailable", async () => {
      cacheMock.tryLock.mockResolvedValueOnce({ ok: false, error: { code: "redis_connection_error" } });
      sheetsMock.update.mockImplementation(respondAsync(null));
      sheetsMock.append.mockImplementation(respondAsync(null));

      await writeData(authorizedIntegration, "sheet1", ["answer"], ["question"]);

      expect(sheetsMock.append).toHaveBeenCalledTimes(1);
      expect(cacheMock.runRedisOperation).not.toHaveBeenCalled();
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
