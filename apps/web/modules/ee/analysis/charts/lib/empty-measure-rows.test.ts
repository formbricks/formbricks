import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  canDropEmptyMeasureRows,
  dropEmptyMeasureRows,
} from "@/modules/ee/analysis/charts/lib/empty-measure-rows";

const CES_AVG = "FeedbackRecords.cesAverage";
const CSAT_AVG = "FeedbackRecords.csatAverage";
const FIELD_LABEL = "FeedbackRecords.fieldLabel";
const CREATED_AT = "FeedbackRecords.createdAt";

const groupedQuery: TChartQuery = {
  measures: [CES_AVG, CSAT_AVG],
  dimensions: [FIELD_LABEL],
};

describe("canDropEmptyMeasureRows", () => {
  test("allows dropping for a grouped, non-time query", () => {
    expect(canDropEmptyMeasureRows(groupedQuery)).toBe(true);
  });

  test("keeps a measure-only query intact, so a big number still renders its no-data glyph", () => {
    expect(canDropEmptyMeasureRows({ measures: [CES_AVG] })).toBe(false);
    expect(canDropEmptyMeasureRows({ measures: [CES_AVG], dimensions: [] })).toBe(false);
  });

  test("keeps a time series intact, so empty buckets stay gaps instead of closing up", () => {
    expect(
      canDropEmptyMeasureRows({
        ...groupedQuery,
        timeDimensions: [{ dimension: CREATED_AT, granularity: "day" }],
      })
    ).toBe(false);
  });

  test("allows dropping when a time dimension is only a date-range filter", () => {
    expect(
      canDropEmptyMeasureRows({
        ...groupedQuery,
        timeDimensions: [{ dimension: CREATED_AT, dateRange: ["2026-09-01", "2026-09-10"] }],
      })
    ).toBe(true);
  });

  test("keeps a query that selects no measures intact", () => {
    expect(canDropEmptyMeasureRows({ dimensions: [FIELD_LABEL] })).toBe(false);
  });
});

describe("dropEmptyMeasureRows", () => {
  test("drops questions that carry none of the selected measures", () => {
    const rows = [
      { [FIELD_LABEL]: "How easy was it?", [CES_AVG]: "4.5", [CSAT_AVG]: null },
      { [FIELD_LABEL]: "Which match does this feedback relate to?", [CES_AVG]: null, [CSAT_AVG]: null },
      { [FIELD_LABEL]: "Gender", [CES_AVG]: null, [CSAT_AVG]: null },
      { [FIELD_LABEL]: "How satisfied are you?", [CES_AVG]: null, [CSAT_AVG]: "4.1" },
    ];

    expect(dropEmptyMeasureRows(rows, groupedQuery)).toEqual([rows[0], rows[3]]);
  });

  test("keeps a measured zero — it is a reading, not a missing value", () => {
    const rows = [
      { [FIELD_LABEL]: "Would you recommend us?", [CES_AVG]: 0, [CSAT_AVG]: null },
      { [FIELD_LABEL]: "Gender", [CES_AVG]: null, [CSAT_AVG]: null },
    ];

    expect(dropEmptyMeasureRows(rows, groupedQuery)).toEqual([rows[0]]);
  });

  test("treats an empty string and a missing column as empty", () => {
    const rows = [
      { [FIELD_LABEL]: "Gender", [CES_AVG]: "", [CSAT_AVG]: undefined },
      { [FIELD_LABEL]: "How easy was it?", [CES_AVG]: "3", [CSAT_AVG]: undefined },
    ];

    expect(dropEmptyMeasureRows(rows, groupedQuery)).toEqual([rows[1]]);
  });

  test("keeps every row when the result names none of the query's measures", () => {
    const rows = [
      { [FIELD_LABEL]: "Gender", "FeedbackRecords.count": null },
      { [FIELD_LABEL]: "How easy was it?", "FeedbackRecords.count": null },
    ];

    expect(dropEmptyMeasureRows(rows, groupedQuery)).toEqual(rows);
  });

  test("leaves a time series untouched, empty buckets included", () => {
    const rows = [
      { [`${CREATED_AT}.day`]: "2026-09-01", [CES_AVG]: "4.5" },
      { [`${CREATED_AT}.day`]: "2026-09-02", [CES_AVG]: null },
      { [`${CREATED_AT}.day`]: "2026-09-03", [CES_AVG]: "4.2" },
    ];
    const query: TChartQuery = {
      measures: [CES_AVG],
      dimensions: [FIELD_LABEL],
      timeDimensions: [{ dimension: CREATED_AT, granularity: "day" }],
    };

    expect(dropEmptyMeasureRows(rows, query)).toEqual(rows);
  });

  test("leaves a measure-only row untouched even when the measure is null", () => {
    const rows = [{ [CES_AVG]: null }];

    expect(dropEmptyMeasureRows(rows, { measures: [CES_AVG] })).toEqual(rows);
  });

  test("returns an empty result unchanged", () => {
    expect(dropEmptyMeasureRows([], groupedQuery)).toEqual([]);
  });

  test("drops every row when no group answers any measure", () => {
    const rows = [
      { [FIELD_LABEL]: "Gender", [CES_AVG]: null, [CSAT_AVG]: null },
      { [FIELD_LABEL]: "Nationality", [CES_AVG]: null, [CSAT_AVG]: null },
    ];

    expect(dropEmptyMeasureRows(rows, groupedQuery)).toEqual([]);
  });
});
