import { describe, expect, test } from "vitest";
import { isChartResultEmpty } from "@/modules/ee/analysis/charts/lib/chart-emptiness";

const COUNT = "FeedbackRecords.count";
const NPS_SCORE = "FeedbackRecords.npsScore";
const NPS_COUNT = "FeedbackRecords.npsCount";
const PROMOTERS = "FeedbackRecords.promoterCount";
const VERY_NEGATIVE = "FeedbackRecords.veryNegativeCount";
const SENTIMENT_AVG = "FeedbackRecords.sentimentAverage";
const UNIQUE_RESPONDENTS = "FeedbackRecords.uniqueRespondents";
const SOURCE = "FeedbackRecords.sourceName";
const CREATED_AT_DAY = "FeedbackRecords.createdAt.day";

describe("isChartResultEmpty", () => {
  test("treats no rows as empty", () => {
    expect(isChartResultEmpty([], { measures: [COUNT] })).toBe(true);
    expect(isChartResultEmpty(undefined, { measures: [COUNT] })).toBe(true);
  });

  test("treats the one aggregate row of a measure-only query that matched nothing as empty", () => {
    expect(isChartResultEmpty([{ [COUNT]: 0 }], { measures: [COUNT] })).toBe(true);
    expect(isChartResultEmpty([{ [COUNT]: "0" }], { measures: [COUNT] })).toBe(true);
  });

  test("keeps a record count above zero", () => {
    expect(isChartResultEmpty([{ [COUNT]: 12 }], { measures: [COUNT] })).toBe(false);
  });

  test("treats a row whose every measure is NULL as empty", () => {
    expect(isChartResultEmpty([{ [SENTIMENT_AVG]: null }], { measures: [SENTIMENT_AVG] })).toBe(true);
  });

  test("keeps a measured 0 when nothing proves the population is empty", () => {
    expect(isChartResultEmpty([{ [VERY_NEGATIVE]: 0 }], { measures: [VERY_NEGATIVE] })).toBe(false);
  });

  test("keeps a unique-respondents 0, since anonymous records exist without respondents", () => {
    expect(isChartResultEmpty([{ [UNIQUE_RESPONDENTS]: 0 }], { measures: [UNIQUE_RESPONDENTS] })).toBe(false);
  });

  test("treats a zero response base as empty, even when the user did not select it", () => {
    expect(
      isChartResultEmpty([{ [NPS_SCORE]: null, [PROMOTERS]: 0, [NPS_COUNT]: 0 }], {
        measures: [NPS_SCORE, PROMOTERS],
      })
    ).toBe(true);
  });

  test("keeps a real NPS of 0 that rests on answers", () => {
    expect(isChartResultEmpty([{ [NPS_SCORE]: 0, [NPS_COUNT]: 10 }], { measures: [NPS_SCORE] })).toBe(false);
  });

  test("treats a zero record count as empty even next to another measure's 0", () => {
    expect(
      isChartResultEmpty([{ [COUNT]: 0, [VERY_NEGATIVE]: 0 }], { measures: [COUNT, VERY_NEGATIVE] })
    ).toBe(true);
  });

  test("keeps a time series with any bucket that has a reading", () => {
    const query = {
      measures: [COUNT],
      timeDimensions: [{ dimension: "FeedbackRecords.createdAt", granularity: "day" as const }],
    };
    expect(
      isChartResultEmpty(
        [
          { [CREATED_AT_DAY]: "2026-01-01", [COUNT]: 0 },
          { [CREATED_AT_DAY]: "2026-01-02", [COUNT]: 3 },
        ],
        query
      )
    ).toBe(false);
    expect(
      isChartResultEmpty(
        [
          { [CREATED_AT_DAY]: "2026-01-01", [COUNT]: 0 },
          { [CREATED_AT_DAY]: "2026-01-02", [COUNT]: 0 },
        ],
        query
      )
    ).toBe(true);
  });

  test("keeps grouped rows whose measures all read NULL in some rows but not all", () => {
    expect(
      isChartResultEmpty(
        [
          { [SOURCE]: "a", [SENTIMENT_AVG]: null },
          { [SOURCE]: "b", [SENTIMENT_AVG]: 0.4 },
        ],
        { measures: [SENTIMENT_AVG], dimensions: [SOURCE] }
      )
    ).toBe(false);
  });

  test("does not judge rows empty when no selected measure is a column on them", () => {
    expect(isChartResultEmpty([{ other: 0 }], { measures: [COUNT] })).toBe(false);
  });
});
