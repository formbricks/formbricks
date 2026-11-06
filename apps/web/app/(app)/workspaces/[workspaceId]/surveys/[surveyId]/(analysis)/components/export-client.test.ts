import { describe, expect, test, vi } from "vitest";
import type { TExportRequest } from "@/lib/analysis-export/export-request";
import {
  ExportRequestError,
  fetchExportCounts,
  formatBytes,
  parseFileName,
  requestExport,
} from "./export-client";

const request: TExportRequest = {
  format: "csv",
  display: "text",
  spss: false,
  zip: false,
  advanced: [],
  excludedColumns: [],
};

const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

describe("parseFileName", () => {
  test("reads the quoted file name", () => {
    expect(parseFileName('attachment; filename="export-a-b.csv"')).toBe("export-a-b.csv");
  });
  test("is null without a usable header", () => {
    expect(parseFileName(null)).toBeNull();
    expect(parseFileName("inline")).toBeNull();
  });
});

describe("requestExport", () => {
  test("POSTs the request to the survey's export route and reads the body with progress", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(streamOf(["ab", "cde"]), {
        headers: {
          "Content-Disposition": 'attachment; filename="f.csv"',
          "Content-Type": "text/csv;charset=utf-8",
        },
      })
    );
    const progress: number[] = [];
    const signal = new AbortController().signal;
    const result = await requestExport({
      surveyId: "s1",
      request,
      signal,
      onProgress: (bytes) => progress.push(bytes),
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/surveys/s1/export",
      expect.objectContaining({ method: "POST", signal, body: JSON.stringify(request) })
    );
    expect(result.fileName).toBe("f.csv");
    expect(await result.blob.text()).toBe("abcde");
    expect(progress.at(-1)).toBe(5);
  });

  test("counts the rows of a CSV as they arrive: the lines less the header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(streamOf(["a,b\r\n1,2\r\n3", ",4\r\n5,6\r\n"])));
    const rows: number[] = [];
    await requestExport({
      surveyId: "s1",
      request,
      signal: new AbortController().signal,
      rowOutput: "csv",
      onRows: (count) => rows.push(count),
      fetchImpl,
    });
    expect(rows).toEqual([1, 3]);
  });

  test("a failed request throws with the server's reason", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "The workbook is too big" }), {
        status: 422,
        headers: { "Content-Type": "application/problem+json" },
      })
    );
    await expect(
      requestExport({ surveyId: "s1", request, signal: new AbortController().signal, fetchImpl })
    ).rejects.toMatchObject({ name: "ExportRequestError", status: 422, message: "The workbook is too big" });
  });

  test("a failure with no readable body still throws an ExportRequestError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>", { status: 502 }));
    await expect(
      requestExport({ surveyId: "s1", request, signal: new AbortController().signal, fetchImpl })
    ).rejects.toBeInstanceOf(ExportRequestError);
  });
});

describe("fetchExportCounts", () => {
  test("asks for the counts with dryRun", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { included: 5, lowQualityLeftOut: 1, kind: "analysis" } }))
      );
    const counts = await fetchExportCounts({
      surveyId: "s1",
      request,
      signal: new AbortController().signal,
      fetchImpl,
    });
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/surveys/s1/export?dryRun=true");
    expect(counts).toEqual({ included: 5, lowQualityLeftOut: 1, kind: "analysis" });
  });
});

describe("formatBytes", () => {
  test("small sizes in KB, at least 1, and larger ones in MB with a decimal", () => {
    expect(formatBytes(10)).toBe("1 KB");
    expect(formatBytes(340 * 1024)).toBe("340 KB");
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2.4 MB");
  });
});
