import { describe, expect, test } from "vitest";
import {
  EXPORT_ADVANCED_OPTIONS,
  EXPORT_MAX_SELECTED_RESPONSES,
  ZExportRequest,
  exportFileType,
  planExport,
  resolveIncludeLowQuality,
} from "./export-request";

const parse = (input: unknown) => ZExportRequest.safeParse(input);

describe("ZExportRequest", () => {
  test("the Standard defaults need only a format", () => {
    const result = parse({ format: "csv" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      format: "csv",
      display: "text",
      spss: false,
      zip: false,
      advanced: [],
      excludedColumns: [],
    });
  });

  test("Compress into .zip is for CSV", () => {
    expect(parse({ format: "csv", zip: true }).success).toBe(true);
    expect(parse({ format: "xlsx", zip: true }).success).toBe(false);
  });

  test("a filter that went through JSON gets its createdAt dates back", () => {
    const sent = JSON.parse(
      JSON.stringify({
        format: "csv",
        filter: {
          createdAt: { min: new Date("2026-10-20T00:00:00.000Z"), max: new Date("2026-10-28T00:00:00.000Z") },
        },
      })
    );
    const result = parse(sent);
    expect(result.success).toBe(true);
    expect(result.data?.filter?.createdAt).toEqual({
      min: new Date("2026-10-20T00:00:00.000Z"),
      max: new Date("2026-10-28T00:00:00.000Z"),
    });
    expect(parse({ format: "csv", filter: { createdAt: { min: "not a date" } } }).success).toBe(false);
  });

  test("rejects the SPSS syntax file on Excel", () => {
    expect(parse({ format: "xlsx", display: "codes", spss: true }).success).toBe(false);
  });

  test("rejects the SPSS syntax file with Text only", () => {
    expect(parse({ format: "csv", display: "text", spss: true }).success).toBe(false);
  });

  test("rejects unknown keys and unknown advanced options", () => {
    expect(parse({ format: "csv", extra: 1 }).success).toBe(false);
    expect(parse({ format: "csv", advanced: ["nope"] }).success).toBe(false);
  });

  test("an advanced option that does not apply to the format is rejected", () => {
    const only = EXPORT_ADVANCED_OPTIONS.find((option) => option.appliesTo.length === 1);
    if (!only) return; // every current option applies to both formats
    const other = only.appliesTo[0] === "csv" ? "xlsx" : "csv";
    expect(parse({ format: other, advanced: [only.id] }).success).toBe(false);
  });

  test("selected responses are bounded and must be ids", () => {
    const ids = Array.from({ length: EXPORT_MAX_SELECTED_RESPONSES + 1 }, (_, i) => `a${i}`.padEnd(25, "x"));
    expect(parse({ format: "csv", filter: { responseIds: ids } }).success).toBe(false);
    expect(parse({ format: "csv", filter: { responseIds: ["not an id"] } }).success).toBe(false);
  });
});

describe("planExport", () => {
  test("the defaults are the Standard export, for both formats", () => {
    expect(planExport({ format: "csv", display: "text", spss: false, advanced: [] })).toEqual({
      kind: "standard",
      format: "csv",
    });
    expect(planExport({ format: "xlsx", display: "text", spss: false, advanced: [] })).toEqual({
      kind: "standard",
      format: "xlsx",
    });
  });

  test("Compress into .zip makes a single CSV a zip, the Standard one included", () => {
    expect(
      planExport({ format: "csv", display: "codes", spss: false, advanced: [], zip: true })
    ).toMatchObject({ kind: "analysis", output: "zip" });
    const standard = planExport({ format: "csv", display: "text", spss: false, advanced: [], zip: true });
    expect(standard).toEqual({ kind: "standard", format: "csv", zip: true });
    expect(exportFileType(standard).extension).toBe("zip");
    expect(
      planExport({ format: "xlsx", display: "codes", spss: false, advanced: [], zip: true })
    ).toMatchObject({
      output: "xlsx",
    });
  });

  test("Code only on CSV is a single CSV Analysis export", () => {
    const plan = planExport({ format: "csv", display: "codes", spss: false, advanced: [] });
    expect(plan).toMatchObject({
      kind: "analysis",
      output: "csv",
      display: "codes",
      include: { datamap: false, unmappedValues: false, spssSyntax: false },
    });
  });

  test("Text and code on CSV is two files, so a zip", () => {
    expect(planExport({ format: "csv", display: "both", spss: false, advanced: [] })).toMatchObject({
      kind: "analysis",
      output: "zip",
    });
  });

  test("the SPSS syntax file or a file-adding advanced option forces the zip", () => {
    expect(planExport({ format: "csv", display: "codes", spss: true, advanced: [] })).toMatchObject({
      output: "zip",
      include: { spssSyntax: true },
    });
    expect(planExport({ format: "csv", display: "codes", spss: false, advanced: ["datamap"] })).toMatchObject(
      {
        output: "zip",
        include: { datamap: true, unmappedValues: false },
      }
    );
  });

  test("Text only with an advanced option is an Analysis export, never the Standard file", () => {
    expect(
      planExport({ format: "csv", display: "text", spss: false, advanced: ["unmappedValues"] })
    ).toMatchObject({
      kind: "analysis",
      display: "text",
      output: "zip",
    });
  });

  test("Excel Analysis exports are one workbook", () => {
    expect(planExport({ format: "xlsx", display: "both", spss: false, advanced: ["datamap"] })).toMatchObject(
      {
        kind: "analysis",
        output: "xlsx",
        include: { datamap: true },
      }
    );
  });
});

describe("Display questions", () => {
  test("Text only questions with Text only answers is still the Standard export, even with columns switched off", () => {
    expect(
      planExport({ format: "csv", display: "text", questions: "text", spss: false, advanced: [] }).kind
    ).toBe("standard");
    expect(parse({ format: "csv", excludedColumns: ["tags"] }).data?.excludedColumns).toEqual(["tags"]);
  });

  test("any other Display questions makes it an Analysis export, whatever the answers say", () => {
    const plan = planExport({
      format: "csv",
      display: "text",
      questions: "codes",
      spss: false,
      advanced: [],
    });
    expect(plan).toMatchObject({ kind: "analysis", display: "text", questions: "codes", output: "csv" });
  });

  test("rejects the SPSS syntax file with Text only questions", () => {
    expect(parse({ format: "csv", display: "codes", questions: "text", spss: true }).success).toBe(false);
    expect(parse({ format: "csv", display: "codes", questions: "both", spss: true }).success).toBe(true);
  });
});

describe("Low quality responses", () => {
  test("the request may carry the choice, and leaving it out keeps the kind's default", () => {
    expect(parse({ format: "csv", includeLowQuality: false }).data?.includeLowQuality).toBe(false);
    expect(parse({ format: "csv" }).data?.includeLowQuality).toBeUndefined();
    expect(parse({ format: "csv", includeLowQuality: "yes" }).success).toBe(false);
  });

  test("the Standard export keeps them by default and an Analysis export leaves them out", () => {
    const standard = planExport(ZExportRequest.parse({ format: "csv" }));
    const analysis = planExport(ZExportRequest.parse({ format: "csv", display: "codes" }));
    expect(resolveIncludeLowQuality({}, standard)).toBe(true);
    expect(resolveIncludeLowQuality({}, analysis)).toBe(false);
  });

  test("an explicit choice wins on either kind", () => {
    const standard = planExport(ZExportRequest.parse({ format: "csv" }));
    const analysis = planExport(ZExportRequest.parse({ format: "csv", display: "codes" }));
    expect(resolveIncludeLowQuality({ includeLowQuality: false }, standard)).toBe(false);
    expect(resolveIncludeLowQuality({ includeLowQuality: true }, analysis)).toBe(true);
  });
});
