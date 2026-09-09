import { describe, expect, test } from "vitest";
import type { TImportReport } from "../types";
import {
  buildImportConvertedProperties,
  buildImportCreatedProperties,
  buildImportFailedProperties,
  readProblemCode,
} from "./import-analytics";

const report: TImportReport = {
  source: { lane: "ai", kind: "docx", fileName: "q.docx", chunks: 3 },
  summary: {
    blocks: 4,
    elements: 21,
    endings: 1,
    languages: ["en-US", "de-DE"],
    logicRules: 0,
    logicRulesReported: 0,
    hiddenFields: 0,
  },
  issues: [
    { severity: "warning", code: "translation_filled", message: "" },
    { severity: "warning", code: "translation_filled", message: "" },
    { severity: "warning", code: "chunk_failed", message: "" },
    { severity: "info", code: "chunked", message: "" },
    { severity: "error", code: "nothing_extracted", message: "" },
  ],
};

describe("import analytics properties", () => {
  test("survey_import_converted carries counts, distinct warning codes and the source", () => {
    expect(
      buildImportConvertedProperties(report, { durationMs: 1234, hasDocument: true, streamed: true })
    ).toEqual({
      source_kind: "docx",
      lane: "ai",
      question_count: 21,
      language_count: 2,
      warning_count: 3,
      error_count: 1,
      import_warning_codes: ["chunk_failed", "translation_filled"],
      has_document: true,
      duration_ms: 1234,
      streamed: true,
    });
    expect(buildImportConvertedProperties(report, { durationMs: 1, hasDocument: false })).not.toHaveProperty(
      "streamed"
    );
  });

  test("survey_import_failed defaults unknown source and lane to null", () => {
    expect(buildImportFailedProperties({ code: "unsupported_source", status: 422 })).toEqual({
      source_kind: null,
      lane: null,
      code: "unsupported_source",
      status: 422,
    });
    expect(
      buildImportFailedProperties({ sourceKind: "qsf", lane: "structured", code: "x", streamed: true })
    ).toMatchObject({
      source_kind: "qsf",
      lane: "structured",
      status: null,
      streamed: true,
    });
  });

  test("survey_created import properties", () => {
    expect(buildImportCreatedProperties(report)).toEqual({
      import_source: "docx",
      import_lane: "ai",
      import_ai_used: true,
      import_warning_count: 3,
      import_chunk_count: 3,
    });
  });

  test("readProblemCode reads the code without consuming the response", async () => {
    const response = new Response(JSON.stringify({ code: "lane_not_available" }), { status: 400 });
    expect(await readProblemCode(response)).toBe("lane_not_available");
    expect((await response.json()).code).toBe("lane_not_available");
    expect(await readProblemCode(new Response("nope", { status: 500 }))).toBe("http_500");
  });
});
