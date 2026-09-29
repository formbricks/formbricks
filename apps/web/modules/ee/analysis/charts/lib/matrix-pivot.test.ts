import { describe, expect, test } from "vitest";
import {
  MATRIX_COLOR_STEPS,
  buildMatrixPivot,
  buildMatrixQuestionQuery,
  formatMatrixCell,
  getMatrixColorStep,
  getMatrixQueryIssues,
  getMatrixQuestionLabel,
  isMatrixTooLarge,
  resolveMatrixDisplay,
  toMatrixGrid,
} from "./matrix-pivot";

const ROW = "FeedbackRecords.fieldId";
const COL = "FeedbackRecords.valueId";
const COUNT = "FeedbackRecords.count";

const rowLabels: Record<string, string> = {
  q1__easy: "It was easy to use",
  q1__fast: "It was fast",
  q1__fun: "It was fun",
};
const columnLabels: Record<string, string> = {
  disagree: "Disagree",
  neutral: "Neutral",
  agree: "Agree",
};

const record = (row: string, column: string, count: number) => ({
  [ROW]: row,
  [COL]: column,
  [COUNT]: count,
});

const pivotOf = (
  data: Record<string, unknown>[],
  overrides: Partial<Parameters<typeof buildMatrixPivot>[0]> = {}
) =>
  buildMatrixPivot({
    data: data as never,
    rowKey: ROW,
    columnKey: COL,
    measureKey: COUNT,
    rowOrder: Object.keys(rowLabels),
    columnOrder: Object.keys(columnLabels),
    formatRowLabel: (v) => rowLabels[v] ?? v,
    formatColumnLabel: (v) => columnLabels[v] ?? v,
    ...overrides,
  });

describe("getMatrixQueryIssues", () => {
  test("accepts two groupings, one measure and a date range", () => {
    expect(
      getMatrixQueryIssues({
        measures: [COUNT],
        dimensions: [ROW, COL],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange: "last 30 days" }],
      })
    ).toEqual([]);
  });

  test("names every missing piece, in the order the checklist shows them", () => {
    expect(
      getMatrixQueryIssues({
        measures: [COUNT, "FeedbackRecords.uniqueResponses"],
        dimensions: [ROW],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "week" }],
      })
    ).toEqual(["needs_one_measure", "needs_two_groupings", "no_time_grouping"]);
    expect(getMatrixQueryIssues(null)).toEqual(["needs_one_measure", "needs_two_groupings"]);
  });
});

describe("buildMatrixQuestionQuery / getMatrixQuestionLabel", () => {
  test("builds the recipe and reads the question back", () => {
    const query = buildMatrixQuestionQuery("How was it?");
    expect(query).toEqual({
      measures: [COUNT],
      dimensions: [ROW, COL],
      filters: [{ member: "FeedbackRecords.fieldGroupLabel", operator: "equals", values: ["How was it?"] }],
    });
    expect(getMatrixQuestionLabel(query)).toBe("How was it?");
  });

  test("keeps the date range but drops a time bucket", () => {
    const query = buildMatrixQuestionQuery("Q", [
      { dimension: "FeedbackRecords.collectedAt", granularity: "week", dateRange: "last 7 days" },
    ]);
    expect(query.timeDimensions).toEqual([
      { dimension: "FeedbackRecords.collectedAt", dateRange: "last 7 days" },
    ]);
  });

  test("is null once the recipe has been edited into something else", () => {
    const query = buildMatrixQuestionQuery("Q");
    expect(getMatrixQuestionLabel({ ...query, dimensions: [COL, ROW] })).toBeNull();
    expect(
      getMatrixQuestionLabel({
        ...query,
        filters: [{ member: "FeedbackRecords.fieldGroupLabel", operator: "contains", values: ["Q"] }],
      })
    ).toBeNull();
  });
});

describe("buildMatrixPivot", () => {
  test("lays rows and columns out in survey order with row shares", () => {
    const pivot = pivotOf([
      record("q1__fast", "agree", 6),
      record("q1__easy", "agree", 3),
      record("q1__easy", "disagree", 1),
      record("q1__fast", "neutral", 2),
    ]);

    expect(pivot.columns.map((c) => c.label)).toEqual(["Disagree", "Neutral", "Agree"]);
    expect(pivot.rows.map((r) => r.label)).toEqual(["It was easy to use", "It was fast"]);
    expect(pivot.rows[0].cells.map((c) => c.share)).toEqual([0.25, 0, 0.75]);
    expect(pivot.rows[1].cells.map((c) => c.value)).toEqual([0, 2, 6]);
    expect(pivot.rows.map((r) => r.total)).toEqual([4, 8]);
    expect(pivot.columns.map((c) => c.total)).toEqual([1, 2, 9]);
    expect(pivot.grandTotal).toBe(12);
  });

  test("keeps unanswered scale points and statements when the question was pinned", () => {
    const pivot = pivotOf([record("q1__easy", "agree", 2)], {
      includeUnansweredColumns: true,
      includeUnansweredRows: true,
    });

    expect(pivot.columns.map((c) => c.key)).toEqual(["disagree", "neutral", "agree"]);
    expect(pivot.rows.map((r) => [r.key, r.isEmpty])).toEqual([
      ["q1__easy", false],
      ["q1__fast", true],
      ["q1__fun", true],
    ]);
    expect(pivot.rows[1].cells.every((c) => c.value === 0 && c.share === null)).toBe(true);
  });

  test("without a label map, orders columns by label and rows by size", () => {
    const pivot = pivotOf(
      [record("DE", "web", 1), record("US", "app", 5), record("US", "web", 4), record("DE", "app", 2)],
      { rowOrder: undefined, columnOrder: undefined, formatRowLabel: (v) => v, formatColumnLabel: (v) => v }
    );

    expect(pivot.columns.map((c) => c.key)).toEqual(["app", "web"]);
    expect(pivot.rows.map((r) => r.key)).toEqual(["US", "DE"]);
  });

  test("a ratio measure is neither shared nor totalled", () => {
    const measureKey = "FeedbackRecords.npsScore";
    const pivot = buildMatrixPivot({
      data: [
        { [ROW]: "DE", [COL]: "web", [measureKey]: 40 },
        { [ROW]: "DE", [COL]: "app", [measureKey]: -10 },
      ],
      rowKey: ROW,
      columnKey: COL,
      measureKey,
      formatRowLabel: (v) => v,
      formatColumnLabel: (v) => v,
    });

    expect(pivot.isAdditive).toBe(false);
    expect(pivot.rows[0].total).toBeNull();
    expect(pivot.grandTotal).toBeNull();
    expect(pivot.rows[0].cells.map((c) => c.share)).toEqual([null, null]);
  });

  test("skips records missing either grouping", () => {
    const pivot = pivotOf([record("q1__easy", "agree", 2), { [ROW]: null, [COL]: "agree", [COUNT]: 9 }]);
    expect(pivot.grandTotal).toBe(2);
  });
});

describe("toMatrixGrid", () => {
  test("transposing swaps the axes but keeps shares of the original row", () => {
    const pivot = pivotOf([record("q1__easy", "agree", 3), record("q1__easy", "disagree", 1)]);
    const grid = toMatrixGrid(pivot, true);

    expect(grid.rowHeaders.map((r) => r.label)).toEqual(["Disagree", "Agree"]);
    expect(grid.columnHeaders.map((c) => c.label)).toEqual(["It was easy to use"]);
    expect(grid.cells.map((row) => row[0].share)).toEqual([0.25, 0.75]);
    expect(grid.cells[1][0]).toMatchObject({
      rowLabel: "It was easy to use",
      columnLabel: "Agree",
      shareBase: 4,
    });
  });
});

describe("formatMatrixCell", () => {
  const formatValue = (v: number) => String(v);
  const formatShare = (s: number) => `${Math.round(s * 100)}%`;

  test("prints the chosen cell value", () => {
    const cell = { value: 105, share: 0.42 };
    expect(formatMatrixCell(cell, "percent", formatValue, formatShare)).toBe("42%");
    expect(formatMatrixCell(cell, "count", formatValue, formatShare)).toBe("105");
    expect(formatMatrixCell(cell, "both", formatValue, formatShare)).toBe("42% (105)");
  });

  test("falls back to the value where there is no share", () => {
    expect(formatMatrixCell({ value: 7.5, share: null }, "percent", formatValue, formatShare)).toBe("7.5");
  });
});

describe("getMatrixColorStep", () => {
  const pivot = { maxValue: 10, maxShare: 0.5 };

  test("zero is untinted and the largest cell takes the darkest step", () => {
    expect(getMatrixColorStep({ value: 0, share: 0 }, pivot, "percent")).toBe(0);
    expect(getMatrixColorStep({ value: 10, share: 0.5 }, pivot, "percent")).toBe(MATRIX_COLOR_STEPS - 1);
  });

  test("tracks the number being read", () => {
    // A small share but the largest count: pale by share, darkest by count.
    const cell = { value: 10, share: 0.05 };
    expect(getMatrixColorStep(cell, pivot, "percent")).toBe(1);
    expect(getMatrixColorStep(cell, pivot, "count")).toBe(MATRIX_COLOR_STEPS - 1);
  });
});

describe("isMatrixTooLarge / resolveMatrixDisplay", () => {
  test("caps the grid at 30 × 15", () => {
    const lines = (n: number) => Array.from({ length: n }, () => ({}));
    expect(isMatrixTooLarge({ rows: lines(30), columns: lines(15) } as never)).toBe(false);
    expect(isMatrixTooLarge({ rows: lines(31), columns: lines(1) } as never)).toBe(true);
    expect(isMatrixTooLarge({ rows: lines(1), columns: lines(16) } as never)).toBe(true);
  });

  test("an empty config renders percent, tinted, without totals, unswapped", () => {
    expect(resolveMatrixDisplay({})).toEqual({
      cellValue: "percent",
      colorScale: true,
      showTotals: false,
      transpose: false,
    });
  });
});
