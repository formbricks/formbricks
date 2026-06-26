import { afterEach, describe, expect, test, vi } from "vitest";
import { importCsvFile } from "./csv-import-client";
import { CSV_IMPORT_FAILED_ERROR_CODE, CSV_MAX_RECORDS_ERROR_CODE } from "./types";

const createCsvFile = () => new File(["submission_id,field_id\nsub-1,q1"], "data.csv", { type: "text/csv" });

const mockFetchResponse = (response: Response) => {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

describe("importCsvFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uploads the CSV file with the required form fields", async () => {
    const resultBody = { successes: 1, failures: 0, skipped: 0 };
    const fetchMock = mockFetchResponse(new Response(JSON.stringify(resultBody), { status: 200 }));
    const file = createCsvFile();

    const result = await importCsvFile({
      feedbackSourceId: "source-1",
      workspaceId: "workspace-1",
      file,
    });

    expect(result).toEqual({ data: resultBody });
    expect(fetchMock).toHaveBeenCalledWith("/api/unify-feedback/sources/csv/import", {
      method: "POST",
      body: expect.any(FormData),
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as FormData;
    expect(body.get("feedbackSourceId")).toBe("source-1");
    expect(body.get("workspaceId")).toBe("workspace-1");
    expect(body.get("file")).toBe(file);
  });

  test("returns the server validation error payload", async () => {
    mockFetchResponse(
      new Response(JSON.stringify({ error: CSV_MAX_RECORDS_ERROR_CODE, max: 1_000, row: 1_001 }), {
        status: 400,
      })
    );

    const result = await importCsvFile({
      feedbackSourceId: "source-1",
      workspaceId: "workspace-1",
      file: createCsvFile(),
    });

    expect(result).toEqual({
      error: {
        error: CSV_MAX_RECORDS_ERROR_CODE,
        max: 1_000,
        row: 1_001,
      },
    });
  });

  test("falls back to a generic error when the server returns invalid JSON", async () => {
    mockFetchResponse(new Response("not-json", { status: 413 }));

    const result = await importCsvFile({
      feedbackSourceId: "source-1",
      workspaceId: "workspace-1",
      file: createCsvFile(),
    });

    expect(result).toEqual({
      error: {
        error: CSV_IMPORT_FAILED_ERROR_CODE,
        max: undefined,
        row: undefined,
      },
    });
  });

  test("falls back to a generic error when the upload request fails", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await importCsvFile({
      feedbackSourceId: "source-1",
      workspaceId: "workspace-1",
      file: createCsvFile(),
    });

    expect(result).toEqual({ error: { error: CSV_IMPORT_FAILED_ERROR_CODE } });
  });

  test("falls back to a generic error code when the server omits one", async () => {
    mockFetchResponse(new Response(JSON.stringify({}), { status: 500 }));

    const result = await importCsvFile({
      feedbackSourceId: "source-1",
      workspaceId: "workspace-1",
      file: createCsvFile(),
    });

    expect(result).toEqual({
      error: {
        error: CSV_IMPORT_FAILED_ERROR_CODE,
        max: undefined,
        row: undefined,
      },
    });
  });
});
