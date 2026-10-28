import { describe, expect, test } from "vitest";
import { chartUpdateFromEditor } from "./chart-update";

const query = { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceType"] };

describe("chartUpdateFromEditor", () => {
  test("sends only the name and display settings when the type and query are as loaded", () => {
    expect(
      chartUpdateFromEditor(
        { name: "Renamed", type: "bar", query: { ...query }, config: { showLegend: true } },
        { type: "bar", query }
      )
    ).toEqual({ name: "Renamed", config: { showLegend: true } });
  });

  test("treats a query rebuilt in another key order as unchanged", () => {
    const reordered = { dimensions: ["FeedbackRecords.sourceType"], measures: ["FeedbackRecords.count"] };
    expect(
      chartUpdateFromEditor({ name: "n", type: "bar", query: reordered, config: {} }, { type: "bar", query })
    ).not.toHaveProperty("query");
  });

  test("sends the type or the query as soon as either changed", () => {
    const changed = { ...query, dimensions: ["FeedbackRecords.sentiment"] };
    expect(
      chartUpdateFromEditor({ name: "n", type: "pie", query, config: {} }, { type: "bar", query })
    ).toEqual({ name: "n", config: {}, type: "pie" });
    expect(
      chartUpdateFromEditor({ name: "n", type: "bar", query: changed, config: {} }, { type: "bar", query })
    ).toEqual({ name: "n", config: {}, query: changed });
  });

  test("sends everything when nothing was loaded to compare with", () => {
    expect(chartUpdateFromEditor({ name: "n", type: "bar", query, config: {} }, null)).toEqual({
      name: "n",
      config: {},
      type: "bar",
      query,
    });
  });
});
