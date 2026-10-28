import { describe, expect, test } from "vitest";
import { buildChartSummary, buildTextTable, isTruncated, projectRows } from "./chart-result";
import type { TFeedbackChartColumn, TFeedbackChartSpec } from "./chart-spec";

const columns: TFeedbackChartColumn[] = [
  { id: "d", label: "Sentiment", kind: "dimension" },
  { id: "m", label: "NPS: Score", kind: "measure" },
];

describe("projectRows", () => {
  test("keeps the requested columns, fills a missing one with null and drops anything else", () => {
    expect(projectRows([{ d: "positive", m: 4, stray: "x" }, { d: "negative" }], columns)).toEqual([
      { d: "positive", m: 4 },
      { d: "negative", m: null },
    ]);
  });
});

describe("isTruncated", () => {
  test("a full page may have more groups behind it", () => {
    expect(isTruncated(100, {})).toBe(true);
    expect(isTruncated(99, {})).toBe(false);
    expect(isTruncated(5, { limit: 5 })).toBe(true);
    expect(isTruncated(4, { limit: 5 })).toBe(false);
  });
});

describe("buildTextTable", () => {
  test("renders labels, rounds numbers and shows null as (none)", () => {
    expect(
      buildTextTable(columns, [
        { d: "positive", m: 31.456 },
        { d: null, m: null },
      ])
    ).toBe(
      ["| Sentiment | NPS: Score |", "| --- | --- |", "| positive | 31.46 |", "| (none) | (none) |"].join(
        "\n"
      )
    );
  });

  test("keeps free text on one bounded line and escapes the column separator", () => {
    const table = buildTextTable(columns, [{ d: `a | b\nline two ${"x".repeat(100)}`, m: 1 }]);
    const row = table.split("\n")[2];
    expect(row).toContain("a \\| b line two");
    expect(row).toContain("…");
    expect(table.split("\n")).toHaveLength(3);
  });

  test("names how many rows were left out", () => {
    const rows = Array.from({ length: 15 }, (_, index) => ({ d: `v${index}`, m: index }));
    const table = buildTextTable(columns, rows, 10);
    expect(table).toContain("v9");
    expect(table).not.toContain("v10 ");
    expect(table).toContain("(5 more rows");
  });

  test("is empty without rows", () => {
    expect(buildTextTable(columns, [])).toBe("");
  });
});

describe("buildChartSummary", () => {
  const spec: TFeedbackChartSpec = {
    type: "bar",
    title: "NPS: Score by sentiment",
    x: "d",
    xKind: "category",
    y: ["m"],
    omittedMeasures: ["FeedbackRecords.count"],
  };

  test("says what was drawn, how much data there is, what was left out and the top rows", () => {
    const text = buildChartSummary({
      spec,
      columns,
      rows: [{ d: "positive", m: 40 }],
      truncated: true,
      datasetId: "ds4a98xxat96iws9zmbrgj3aaa",
    });
    expect(text).toContain(
      "NPS: Score by sentiment: 1 row from feedback dataset ds4a98xxat96iws9zmbrgj3aaa, shown to the user as a bar chart."
    );
    expect(text).toContain("row limit");
    expect(text).toContain("Not plotted, but in the table: FeedbackRecords.count");
    expect(text).toContain("| positive | 40 |");
  });

  test("an empty result still reads as a result", () => {
    const text = buildChartSummary({
      spec: { ...spec, omittedMeasures: undefined },
      columns,
      rows: [],
      truncated: false,
      datasetId: "ds4a98xxat96iws9zmbrgj3aaa",
    });
    expect(text).toContain("the query returned no rows");
    expect(text).not.toContain("|");
  });
});
