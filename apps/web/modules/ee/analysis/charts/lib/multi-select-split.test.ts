import { describe, expect, test } from "vitest";
import { splitMultiSelectRows } from "./multi-select-split";

const VALUE_DIM = "FeedbackRecords.valueText";
const COUNT_KEY = "FeedbackRecords.count";

describe("splitMultiSelectRows", () => {
  test("returns empty array for empty input", () => {
    expect(splitMultiSelectRows([], VALUE_DIM, [COUNT_KEY])).toEqual([]);
  });

  test("splits a joined row and re-aggregates with a plain row for the same option", () => {
    const rows = [
      { [VALUE_DIM]: "One, Two, Three", [COUNT_KEY]: 5 },
      { [VALUE_DIM]: "One", [COUNT_KEY]: 2 },
    ];

    const result = splitMultiSelectRows(rows, VALUE_DIM, [COUNT_KEY]);

    // Collect results into a map for order-independent assertions.
    const byOption = Object.fromEntries(result.map((r) => [r[VALUE_DIM], r[COUNT_KEY]]));

    expect(byOption["One"]).toBe(7); // 5 from the split + 2 from the plain row
    expect(byOption["Two"]).toBe(5);
    expect(byOption["Three"]).toBe(5);
    expect(result).toHaveLength(3);
  });

  test("passes through rows with null/undefined/empty valueText unchanged", () => {
    const rows = [
      { [VALUE_DIM]: null, [COUNT_KEY]: 3 },
      { [VALUE_DIM]: undefined, [COUNT_KEY]: 1 },
      { [VALUE_DIM]: "", [COUNT_KEY]: 2 },
    ];

    const result = splitMultiSelectRows(rows as any, VALUE_DIM, [COUNT_KEY]);

    // Each null/undefined/empty row is treated as a separate group (all map to the same
    // empty key in practice — counts are summed into one bucket).
    const total = result.reduce((sum, r) => sum + (r[COUNT_KEY] as number), 0);
    expect(total).toBe(6);
  });

  test("keeps splits separate per second dimension (e.g. date)", () => {
    const DATE_DIM = "FeedbackRecords.collectedAt.month";
    const rows = [
      { [VALUE_DIM]: "Alpha, Beta", [COUNT_KEY]: 4, [DATE_DIM]: "2024-01-01T00:00:00.000" },
      { [VALUE_DIM]: "Alpha", [COUNT_KEY]: 1, [DATE_DIM]: "2024-01-01T00:00:00.000" },
      { [VALUE_DIM]: "Alpha, Beta", [COUNT_KEY]: 6, [DATE_DIM]: "2024-02-01T00:00:00.000" },
    ];

    const result = splitMultiSelectRows(rows, VALUE_DIM, [COUNT_KEY]);

    const jan = result.filter((r) => r[DATE_DIM] === "2024-01-01T00:00:00.000");
    const feb = result.filter((r) => r[DATE_DIM] === "2024-02-01T00:00:00.000");

    const janByOption = Object.fromEntries(jan.map((r) => [r[VALUE_DIM], r[COUNT_KEY]]));
    const febByOption = Object.fromEntries(feb.map((r) => [r[VALUE_DIM], r[COUNT_KEY]]));

    // January: Alpha=4+1=5, Beta=4
    expect(janByOption["Alpha"]).toBe(5);
    expect(janByOption["Beta"]).toBe(4);
    // February: Alpha=6, Beta=6
    expect(febByOption["Alpha"]).toBe(6);
    expect(febByOption["Beta"]).toBe(6);
  });

  test("handles multiple measure keys being summed", () => {
    const MEASURE_2 = "FeedbackRecords.responseCount";
    const rows = [
      { [VALUE_DIM]: "X, Y", [COUNT_KEY]: 10, [MEASURE_2]: 2 },
      { [VALUE_DIM]: "X", [COUNT_KEY]: 3, [MEASURE_2]: 1 },
    ];

    const result = splitMultiSelectRows(rows, VALUE_DIM, [COUNT_KEY, MEASURE_2]);

    const byOption = Object.fromEntries(result.map((r) => [r[VALUE_DIM], r]));

    expect(byOption["X"][COUNT_KEY]).toBe(13); // 10 + 3
    expect(byOption["X"][MEASURE_2]).toBe(3); // 2 + 1
    expect(byOption["Y"][COUNT_KEY]).toBe(10);
    expect(byOption["Y"][MEASURE_2]).toBe(2);
  });

  test("a single option (no separator) passes through as-is with no sum change", () => {
    const rows = [{ [VALUE_DIM]: "OnlyOption", [COUNT_KEY]: 7 }];

    const result = splitMultiSelectRows(rows, VALUE_DIM, [COUNT_KEY]);

    expect(result).toHaveLength(1);
    expect(result[0][VALUE_DIM]).toBe("OnlyOption");
    expect(result[0][COUNT_KEY]).toBe(7);
  });
});
