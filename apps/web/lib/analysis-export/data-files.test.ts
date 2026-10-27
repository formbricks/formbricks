import { describe, expect, test } from "vitest";
import { buildSampleExport } from "./__fixtures__/sample-export";
import { dataHeaderCells, dataParts } from "./data-files";

describe("dataParts", () => {
  test("Code gives one data file, Text gives one data file, Text and code gives two", () => {
    expect(dataParts("codes")).toEqual([{ kind: "codes", sheet: "Codes", csvName: "data.csv" }]);
    expect(dataParts("text")).toEqual([{ kind: "labels", sheet: "Labels", csvName: "data.csv" }]);
    expect(dataParts("both")).toEqual([
      { kind: "labels", sheet: "Labels", csvName: "labels.csv" },
      { kind: "codes", sheet: "Codes", csvName: "codes.csv" },
    ]);
  });
});

describe("dataHeaderCells", () => {
  const { columns } = buildSampleExport("both");

  test("with Text and code the labels file reads `column; Question text`, the codes file keeps plain names", () => {
    const labels = dataHeaderCells(columns, "both", "labels");
    expect(labels.slice(0, 6)).toEqual([
      "response_id",
      "language",
      "outcome",
      "timestamp",
      "finished",
      "colour; Which colour do you prefer?",
    ]);
    expect(labels).toContain("fruit_apple; Which fruit do you eat? (it's a long one)");
    expect(dataHeaderCells(columns, "both", "codes")).toEqual(columns.map((column) => column.name));
  });

  test("with one data file the headers are plain column names", () => {
    expect(dataHeaderCells(columns, "codes", "codes")).toEqual(columns.map((column) => column.name));
    expect(dataHeaderCells(columns, "text", "labels")).toEqual(columns.map((column) => column.name));
  });
});
