import { describe, expect, test } from "vitest";
import { analysisWorkbookCells, excelSizeVerdict } from "@/lib/analysis-export/excel-size";
import { EXCEL_EXPORT_MAX_CELLS } from "./export-limits";

describe("EXCEL_EXPORT_MAX_CELLS", () => {
  test("is set: Excel is built whole in memory and must not run without a cap", () => {
    expect(Number.isInteger(EXCEL_EXPORT_MAX_CELLS)).toBe(true);
    expect(EXCEL_EXPORT_MAX_CELLS).toBeGreaterThan(0);
  });

  test("refuses the 25,000 x 300 Text and code workbook that cannot be built", () => {
    const cells = analysisWorkbookCells({ display: "both", columns: 300, responses: 25_000 });
    expect(excelSizeVerdict(cells, EXCEL_EXPORT_MAX_CELLS).tooLarge).toBe(true);
  });

  test("allows an ordinary survey: 2,000 responses, 40 columns, Text and code", () => {
    const cells = analysisWorkbookCells({ display: "both", columns: 40, responses: 2_000 });
    expect(excelSizeVerdict(cells, EXCEL_EXPORT_MAX_CELLS).tooLarge).toBe(false);
  });
});
