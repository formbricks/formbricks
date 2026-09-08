import { afterEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  convertImportFile,
  createImportedSurvey,
  importSurveyDryRun,
  readImportFileAsJson,
} from "./import-client";

const workspaceId = "clxx1234567890123456789012";
const report = { source: { lane: "lossless", kind: "v3-document" }, summary: {}, issues: [] };

const respond = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
    })
  );

afterEach(() => vi.unstubAllGlobals());

describe("import client", () => {
  test("importSurveyDryRun posts the source with dryRun and returns data", async () => {
    respond({
      data: {
        document: { name: "x" },
        references: null,
        report,
        validation: { valid: true, invalid_params: [] },
      },
    });

    const result = await importSurveyDryRun({ workspaceId, source: { document: { name: "x" } } });

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v3/surveys/import");
    expect(JSON.parse(init.body as string)).toEqual({
      workspaceId,
      document: { name: "x" },
      options: { dryRun: true },
    });
    expect(result.document).toEqual({ name: "x" });
  });

  test("convertImportFile sends multipart with the file part named file", async () => {
    respond({
      data: { document: null, references: null, report, validation: { valid: false, invalid_params: [] } },
    });
    const file = new File(["{}"], "survey.qsf", { type: "application/json" });

    await convertImportFile({ workspaceId, file });

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v3/surveys/import/convert");
    const body = init.body as FormData;
    expect(body.get("workspaceId")).toBe(workspaceId);
    expect((body.get("file") as File).name).toBe("survey.qsf");
  });

  test("createImportedSurvey sends document, references and the name override", async () => {
    respond({ data: { survey: { id: "clsvnew0000000000000000001" }, report } }, 201);

    const created = await createImportedSurvey({
      workspaceId,
      document: { name: "x" },
      references: { actionClasses: [] },
      name: "Renamed",
    });

    expect(created).toEqual({ id: "clsvnew0000000000000000001" });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      workspaceId,
      document: { name: "x" },
      references: { actionClasses: [] },
      options: { name: "Renamed" },
    });
  });

  test("a problem response throws a V3ApiError", async () => {
    respond({ title: "Forbidden", status: 403, detail: "nope", code: "forbidden", requestId: "r" }, 403);

    await expect(importSurveyDryRun({ workspaceId, source: { document: {} } })).rejects.toBeInstanceOf(
      V3ApiError
    );
  });

  test("readImportFileAsJson parses JSON (BOM included) and returns null otherwise", async () => {
    await expect(readImportFileAsJson(new File(['﻿{"a":1}'], "a.json"))).resolves.toEqual({ a: 1 });
    await expect(readImportFileAsJson(new File(["Question 1"], "a.txt"))).resolves.toBeNull();
    await expect(readImportFileAsJson(new File(["{ broken"], "a.json"))).resolves.toBeNull();
  });
});
