import { describe, expect, test } from "vitest";
import { formatTableCell } from "./table";

const context = { locale: "en-US" };

describe("formatTableCell", () => {
  test("measures keep their full precision and right-align; a missing one is no data", () => {
    const column = { id: "m", label: "M", kind: "measure" as const };
    expect(formatTableCell(column, 1234.5, {}, context)).toEqual({
      text: "1,234.5",
      numeric: true,
      missing: false,
    });
    expect(formatTableCell(column, null, {}, context)).toEqual({
      text: "No data",
      numeric: true,
      missing: true,
    });
  });

  test("time buckets read in long form", () => {
    const column = { id: "t", label: "T", kind: "time" as const };
    expect(formatTableCell(column, "2026-03-01T00:00:00.000", { granularity: "month" }, context).text).toBe(
      "March 2026"
    );
    expect(formatTableCell(column, "garbage", { granularity: "month" }, context).text).toBe("garbage");
  });

  test("dimensions are humanized", () => {
    const column = { id: "FeedbackRecords.sentiment", label: "Sentiment", kind: "dimension" as const };
    expect(formatTableCell(column, "very_positive", {}, context).text).toBe("Very positive");
    expect(formatTableCell(column, null, {}, context).text).toBe("Not enriched");
  });
});
