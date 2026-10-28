import { describe, expect, test } from "vitest";
import { analysisWorkbookCells, excelSizeVerdict } from "./excel-size";

describe("analysisWorkbookCells", () => {
  test("counts every position of every data sheet, header and blanks included", () => {
    // 3 columns x (4 responses + the header row) on one sheet
    expect(analysisWorkbookCells({ display: "codes", columns: 3, responses: 4 })).toBe(15);
    expect(analysisWorkbookCells({ display: "text", columns: 3, responses: 4 })).toBe(15);
  });

  test("Text and code writes two data sheets", () => {
    expect(analysisWorkbookCells({ display: "both", columns: 300, responses: 25_000 })).toBe(15_000_600);
  });

  test("no responses is the header row only", () => {
    expect(analysisWorkbookCells({ display: "codes", columns: 10, responses: 0 })).toBe(10);
  });
});

describe("excelSizeVerdict", () => {
  test("is not too large at the cap, and is one cell above it", () => {
    expect(excelSizeVerdict(100, 100)).toEqual({ cells: 100, maxCells: 100, tooLarge: false });
    expect(excelSizeVerdict(101, 100)).toEqual({ cells: 101, maxCells: 100, tooLarge: true });
  });

  test("without a cap nothing is too large", () => {
    expect(excelSizeVerdict(10 ** 9, undefined)).toEqual({ cells: 10 ** 9, maxCells: null, tooLarge: false });
  });
});
