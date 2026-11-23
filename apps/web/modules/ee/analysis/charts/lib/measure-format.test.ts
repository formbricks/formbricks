import { describe, expect, test } from "vitest";
import {
  formatMeasureAxisTick,
  formatMeasureValue,
  getMeasureFormat,
  getSharedMeasureFormatId,
} from "./measure-format";

describe("getMeasureFormat", () => {
  test("maps each measure family to its format", () => {
    expect(getMeasureFormat("FeedbackRecords.npsScore")).toBe("integer");
    expect(getMeasureFormat("FeedbackRecords.csatScore")).toBe("percent");
    expect(getMeasureFormat("FeedbackRecords.ratingAverage")).toBe("decimal");
    expect(getMeasureFormat("FeedbackRecords.count")).toBe("count");
    expect(getMeasureFormat("FeedbackRecords.promoterCount")).toBe("count");
    expect(getMeasureFormat("FeedbackRecords.ed_plan_1234abcd")).toBe("default");
    expect(getMeasureFormat(undefined)).toBe("default");
  });
});

describe("formatMeasureValue", () => {
  test("NPS is a whole number", () => {
    expect(formatMeasureValue("FeedbackRecords.npsScore", -18.07, "en-US")).toBe("-18");
    expect(formatMeasureValue("FeedbackRecords.npsScore", -0.2, "en-US")).toBe("0");
  });

  test("CSAT score is a percent in the app locale", () => {
    expect(formatMeasureValue("FeedbackRecords.csatScore", 57.54, "en-US")).toBe("58%");
    expect(formatMeasureValue("FeedbackRecords.csatScore", 57.54, "de-DE")).toBe("58 %");
  });

  test("averages keep one decimal with the locale separator", () => {
    expect(formatMeasureValue("FeedbackRecords.ratingAverage", 3.456, "en-US")).toBe("3.5");
    expect(formatMeasureValue("FeedbackRecords.ratingAverage", 3.456, "de-DE")).toBe("3,5");
    expect(formatMeasureValue("FeedbackRecords.csatAverage", 4, "en-US")).toBe("4.0");
  });

  test("counts carry the thousands separator", () => {
    expect(formatMeasureValue("FeedbackRecords.count", 1234, "en-US")).toBe("1,234");
    expect(formatMeasureValue("FeedbackRecords.count", 1234, "de-DE")).toBe("1.234");
  });

  test("unknown measures keep up to two decimals", () => {
    expect(formatMeasureValue("FeedbackRecords.ed_x", 1.2345, "en-US")).toBe("1.23");
  });

  test("missing values print as empty", () => {
    expect(formatMeasureValue("FeedbackRecords.count", null, "en-US")).toBe("");
    expect(formatMeasureValue("FeedbackRecords.count", "abc", "en-US")).toBe("");
  });

  test("numeric strings from Cube are formatted", () => {
    expect(formatMeasureValue("FeedbackRecords.count", "1500", "en-US")).toBe("1,500");
  });

  test("an invalid locale does not throw", () => {
    expect(formatMeasureValue("FeedbackRecords.count", 12, "not a locale")).toBe("12");
  });
});

describe("getSharedMeasureFormatId", () => {
  test("returns a measure when all share one format", () => {
    expect(
      getSharedMeasureFormatId(["FeedbackRecords.promoterCount", "FeedbackRecords.detractorCount"])
    ).toBe("FeedbackRecords.promoterCount");
  });

  test("returns undefined for mixed formats", () => {
    expect(
      getSharedMeasureFormatId(["FeedbackRecords.npsScore", "FeedbackRecords.csatScore"])
    ).toBeUndefined();
  });
});

describe("formatMeasureAxisTick", () => {
  test("drops the forced decimal on an average's axis only", () => {
    expect(formatMeasureAxisTick("FeedbackRecords.ratingAverage", 3, "en-US")).toBe("3");
    expect(formatMeasureAxisTick("FeedbackRecords.csatScore", 50, "en-US")).toBe("50%");
    expect(formatMeasureAxisTick("FeedbackRecords.count", 2000, "en-US")).toBe("2,000");
  });

  test("a count axis keeps fractional ticks distinct", () => {
    const ticks = [1, 1.2, 1.4, 1.6, 1.8, 2].map((v) =>
      formatMeasureAxisTick("FeedbackRecords.count", v, "en-US")
    );
    expect(ticks).toEqual(["1", "1.2", "1.4", "1.6", "1.8", "2"]);
  });
});
