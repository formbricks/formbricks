import { describe, expect, test } from "vitest";
import { planExport } from "@/lib/analysis-export/export-request";
import {
  DEFAULT_EXPORT_OPTIONS,
  countLineParts,
  excelAlternative,
  exportFileExtension,
  isExcelBlocked,
  isExcelTooLarge,
  isExportReady,
  isSpssAvailable,
  isTextOnlyAvailable,
  isZipAvailable,
  isZipLocked,
  rowProgressOutput,
  setDisplay,
  setExcludedColumns,
  setFormat,
  setQuestions,
  setSpss,
  setZip,
  toExportRequest,
  toggleAdvanced,
} from "./export-options";

describe("the Export modal's options", () => {
  test("open on the Standard defaults, which plan as the Standard export", () => {
    expect(planExport(toExportRequest(DEFAULT_EXPORT_OPTIONS))).toEqual({ kind: "standard", format: "csv" });
  });

  test("ticking the SPSS file moves Text only to Code only and disables Text only", () => {
    const options = setSpss(DEFAULT_EXPORT_OPTIONS, true);
    expect(options).toMatchObject({ spss: true, display: "codes" });
    expect(isTextOnlyAvailable(options)).toBe(false);
    expect(isTextOnlyAvailable(setSpss(options, false))).toBe(true);
  });

  test("ticking the SPSS file keeps Text and code", () => {
    expect(setSpss(setDisplay(DEFAULT_EXPORT_OPTIONS, "both"), true).display).toBe("both");
  });

  test("the SPSS file is CSV only: Excel clears it and the control is unavailable", () => {
    const withSpss = setSpss(DEFAULT_EXPORT_OPTIONS, true);
    expect(isSpssAvailable(withSpss)).toBe(true);
    const excel = setFormat(withSpss, "xlsx");
    expect(excel.spss).toBe(false);
    expect(isSpssAvailable(excel)).toBe(false);
  });

  test("Text only cannot be chosen while the SPSS file is on", () => {
    const options = setSpss(DEFAULT_EXPORT_OPTIONS, true);
    expect(setDisplay(options, "text").display).toBe("codes");
  });

  test("advanced options toggle on and off, and a request carries the ones that are on", () => {
    const on = toggleAdvanced(DEFAULT_EXPORT_OPTIONS, "datamap", true);
    expect(toExportRequest(on).advanced).toEqual(["datamap"]);
    expect(planExport(toExportRequest(on)).kind).toBe("analysis");
    expect(toExportRequest(toggleAdvanced(on, "datamap", false)).advanced).toEqual([]);
  });

  test("the request carries the filter or the selected response ids", () => {
    expect(toExportRequest(DEFAULT_EXPORT_OPTIONS, { filter: { finished: true } }).filter).toEqual({
      finished: true,
    });
    expect(toExportRequest(DEFAULT_EXPORT_OPTIONS, { responseIds: ["a", "b"] }).filter).toEqual({
      responseIds: ["a", "b"],
    });
  });
});

describe("Excel against the size cap", () => {
  const over = { excel: { cells: 2_000_000, maxCells: 1_000_000, tooLarge: true } };
  const under = { excel: { cells: 10, maxCells: 1_000_000, tooLarge: false } };
  const xlsx = setFormat(DEFAULT_EXPORT_OPTIONS, "xlsx");

  test("Excel is too large only when the count says so; the Standard export and a loading count never are", () => {
    expect(isExcelTooLarge(over)).toBe(true);
    expect(isExcelTooLarge(under)).toBe(false);
    expect(isExcelTooLarge({ excel: null })).toBe(false);
    expect(isExcelTooLarge(undefined)).toBe(false);
  });

  test("an Excel export over the cap is blocked, and choosing CSV unblocks it", () => {
    expect(isExcelBlocked(xlsx, over)).toBe(true);
    expect(isExcelBlocked(setFormat(xlsx, "csv"), over)).toBe(false);
    expect(isExcelBlocked(xlsx, under)).toBe(false);
  });

  test("the alternative is a zip of CSV files when the same choices make a zip, else one CSV", () => {
    expect(excelAlternative(setDisplay(xlsx, "codes"))).toBe("csv");
    expect(excelAlternative(setDisplay(xlsx, "both"))).toBe("zip");
    expect(excelAlternative(toggleAdvanced(setDisplay(xlsx, "codes"), "datamap", true))).toBe("zip");
  });
});

describe("Display questions and Include columns", () => {
  test("the defaults send no columns off and the Standard file's name", () => {
    const request = toExportRequest(DEFAULT_EXPORT_OPTIONS, { columnGroups: [{ id: "no", label: "no." }] });
    expect(request).toMatchObject({ questions: "text", display: "text", excludedColumns: [] });
    expect(exportFileExtension(DEFAULT_EXPORT_OPTIONS)).toBe("csv");
  });

  test("switching columns off keeps it the Standard export, and only ids of the current list travel", () => {
    const options = setExcludedColumns(DEFAULT_EXPORT_OPTIONS, ["no", "q:gone"]);
    const request = toExportRequest(options, {
      columnGroups: [
        { id: "no", label: "no." },
        { id: "tags", label: "tags" },
      ],
    });
    expect(request.excludedColumns).toEqual(["no"]);
    expect(planExport(request).kind).toBe("standard");
  });

  test("the SPSS file moves Text only questions to Code only too, and blocks Text only again", () => {
    const options = setSpss(DEFAULT_EXPORT_OPTIONS, true);
    expect(options.questions).toBe("codes");
    expect(setQuestions(options, "text").questions).toBe("codes");
    expect(setQuestions(options, "both").questions).toBe("both");
  });

  test("Text only answers with coded questions is already an Analysis export", () => {
    const options = setQuestions(DEFAULT_EXPORT_OPTIONS, "codes");
    expect(planExport(toExportRequest(options)).kind).toBe("analysis");
  });

  test("the button names the file: csv, xlsx, or zip when there are several files", () => {
    expect(exportFileExtension(setFormat(DEFAULT_EXPORT_OPTIONS, "xlsx"))).toBe("xlsx");
    const spss = setSpss(DEFAULT_EXPORT_OPTIONS, true);
    expect(exportFileExtension(spss)).toBe("zip");
    expect(isZipLocked(spss)).toBe(true);
    expect(isZipLocked(DEFAULT_EXPORT_OPTIONS)).toBe(false);
    expect(exportFileExtension(setDisplay(DEFAULT_EXPORT_OPTIONS, "both"))).toBe("zip");
  });

  test("Compress into .zip is free for a single CSV, locked when the export is a zip anyway, off for Excel", () => {
    const zipped = setZip(setDisplay(DEFAULT_EXPORT_OPTIONS, "codes"), true);
    expect(exportFileExtension(zipped)).toBe("zip");
    expect(isZipLocked(zipped)).toBe(false);
    expect(toExportRequest(zipped).zip).toBe(true);

    const locked = setZip(setSpss(DEFAULT_EXPORT_OPTIONS, true), true);
    expect(isZipLocked(locked)).toBe(true);

    expect(isZipAvailable(zipped)).toBe(true);
    const excel = setFormat(zipped, "xlsx");
    expect(isZipAvailable(excel)).toBe(false);
    expect(excel.zip).toBe(false);
  });

  test("rows can be counted as the file arrives for a CSV and a zip, not for Excel or the Standard export", () => {
    const codes = setDisplay(DEFAULT_EXPORT_OPTIONS, "codes");
    expect(rowProgressOutput(toExportRequest(codes))).toBe("csv");
    expect(rowProgressOutput(toExportRequest(setZip(codes, true)))).toBe("zip");
    expect(rowProgressOutput(toExportRequest(setFormat(codes, "xlsx")))).toBeNull();
    expect(rowProgressOutput(toExportRequest(DEFAULT_EXPORT_OPTIONS))).toBeNull();
  });
});

describe("countLineParts", () => {
  test("no filter, nothing left out: no second line", () => {
    expect(countLineParts({ scope: {}, lowQualityLeftOut: 0, total: 50 })).toEqual([]);
    expect(countLineParts({ scope: { filter: {} }, lowQualityLeftOut: 0, total: 50 })).toEqual([]);
  });

  test("a filter says so and gives the survey total", () => {
    expect(
      countLineParts({ scope: { filter: { finished: true } }, lowQualityLeftOut: 0, total: 22103 })
    ).toEqual([{ key: "filters" }, { key: "total", count: 22103 }]);
  });

  test("Low quality left out is named between the filter and the total", () => {
    expect(
      countLineParts({ scope: { filter: { finished: true } }, lowQualityLeftOut: 88, total: 22103 })
    ).toEqual([
      { key: "filters" },
      { key: "low_quality_left_out", count: 88 },
      { key: "total", count: 22103 },
    ]);
    expect(countLineParts({ scope: {}, lowQualityLeftOut: 2, total: 9 })).toEqual([
      { key: "low_quality_left_out", count: 2 },
      { key: "total", count: 9 },
    ]);
  });

  test("a selection of rows is not a filter", () => {
    expect(countLineParts({ scope: { responseIds: ["a"] }, lowQualityLeftOut: 0, total: 9 })[0]).toEqual({
      key: "selection",
    });
  });
});

describe("isExportReady", () => {
  test("the export waits for the counts of the current options", () => {
    expect(isExportReady({ isSuccess: true, isPlaceholderData: false })).toBe(true);
    // Loading for the first time, or failed: no counts.
    expect(isExportReady({ isSuccess: false, isPlaceholderData: false })).toBe(false);
    // The previous counts are on screen while the new ones load: the column list may be out of date.
    expect(isExportReady({ isSuccess: true, isPlaceholderData: true })).toBe(false);
  });
});
