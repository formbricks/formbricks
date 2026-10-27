import { describe, expect, test } from "vitest";
import { planExport } from "@/lib/analysis-export/export-request";
import {
  DEFAULT_EXPORT_OPTIONS,
  isSpssAvailable,
  isTextOnlyAvailable,
  setDisplay,
  setFormat,
  setSpss,
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
