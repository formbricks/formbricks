import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { computeResponseBase, isInjectedResponseBaseColumn, withResponseBaseMeasure } from "./response-base";

const NPS_SCORE = "FeedbackRecords.npsScore";
const NPS_COUNT = "FeedbackRecords.npsCount";

describe("withResponseBaseMeasure", () => {
  test.each([
    [[NPS_SCORE], NPS_COUNT],
    [["FeedbackRecords.csatScore"], "FeedbackRecords.csatCount"],
    [["FeedbackRecords.cesAverage"], "FeedbackRecords.cesCount"],
    [["FeedbackRecords.ratingAverage"], "FeedbackRecords.ratingCount"],
  ])("adds the base count to %j", (measures, base) => {
    const query: TChartQuery = { measures, dimensions: ["FeedbackRecords.sourceName"] };
    expect(withResponseBaseMeasure(query)).toEqual({ ...query, measures: [...measures, base] });
    expect(query.measures).toEqual(measures);
  });

  test.each([
    ["a mixed-family chart", [NPS_SCORE, "FeedbackRecords.csatScore"]],
    ["a generic count", ["FeedbackRecords.count"]],
    ["a chart that already selects its base", [NPS_SCORE, NPS_COUNT]],
    ["a base-only chart", [NPS_COUNT]],
  ])("returns %s unchanged", (_label, measures) => {
    const query: TChartQuery = { measures };
    expect(withResponseBaseMeasure(query)).toBe(query);
  });

  test("returns a query with no measures unchanged", () => {
    const query: TChartQuery = { dimensions: ["FeedbackRecords.valueBand"] };
    expect(withResponseBaseMeasure(query)).toBe(query);
  });
});

describe("computeResponseBase", () => {
  test("sums the base over every row, numeric strings included", () => {
    expect(
      computeResponseBase([{ [NPS_COUNT]: 12 }, { [NPS_COUNT]: "30" }, { [NPS_COUNT]: 0 }], NPS_COUNT)
    ).toBe(42);
  });

  test("skips null, missing, blank and non-numeric cells", () => {
    expect(
      computeResponseBase(
        [{ [NPS_COUNT]: 5 }, { [NPS_COUNT]: null }, {}, { [NPS_COUNT]: "" }, { [NPS_COUNT]: "n/a" }],
        NPS_COUNT
      )
    ).toBe(5);
  });

  test("is null when no row carries a count, and 0 when they all counted zero", () => {
    expect(computeResponseBase([{ other: 3 }], NPS_COUNT)).toBeNull();
    expect(computeResponseBase([], NPS_COUNT)).toBeNull();
    expect(computeResponseBase([{ [NPS_COUNT]: 0 }], NPS_COUNT)).toBe(0);
  });
});

describe("isInjectedResponseBaseColumn", () => {
  test("flags the base only when the server added it", () => {
    expect(isInjectedResponseBaseColumn(NPS_COUNT, { measures: [NPS_SCORE] })).toBe(true);
    expect(isInjectedResponseBaseColumn(NPS_COUNT, { measures: [NPS_COUNT] })).toBe(false);
    expect(isInjectedResponseBaseColumn(NPS_SCORE, { measures: [NPS_SCORE] })).toBe(false);
    expect(isInjectedResponseBaseColumn("FeedbackRecords.csatCount", { measures: [NPS_SCORE] })).toBe(false);
  });
});
