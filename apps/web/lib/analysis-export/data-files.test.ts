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

describe("dataHeaderCells with Display questions", () => {
  const { columns } = buildSampleExport("both");
  const questionColumn = columns.find(
    (column) => column.question && column.option
  ) as (typeof columns)[number];

  test("Code only is the bare column name in every table", () => {
    expect(dataHeaderCells(columns, "both", "labels", "codes")).toEqual(columns.map((column) => column.name));
    expect(dataHeaderCells(columns, "codes", "codes", "codes")).toEqual(columns.map((column) => column.name));
  });

  test("Text only is what the column asks, with the option or row it stands for", () => {
    const headers = dataHeaderCells(columns, "codes", "codes", "text");
    const index = columns.indexOf(questionColumn);
    expect(headers[index]).toBe(`${questionColumn.question?.headline} – ${questionColumn.option?.label}`);
    expect(headers[0]).toBe("response_id");
  });

  test("Text and code joins the name and the text, the same in the labels and the codes table", () => {
    const index = columns.indexOf(questionColumn);
    const expected = `${questionColumn.name}; ${questionColumn.question?.headline} – ${questionColumn.option?.label}`;
    expect(dataHeaderCells(columns, "both", "labels", "both")[index]).toBe(expected);
    expect(dataHeaderCells(columns, "both", "codes", "both")[index]).toBe(expected);
  });
});
