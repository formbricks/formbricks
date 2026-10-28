import { describe, expect, test } from "vitest";
import {
  formatCalendarDate,
  formatCompact,
  formatFull,
  formatPercent,
  formatTick,
  formatTimeFull,
  formatTimeLabel,
  humanizeValue,
  parseTimestamp,
} from "./format";

describe("numbers", () => {
  test("compact keeps small values and abbreviates thousands", () => {
    expect(formatCompact(31.456, "en-US")).toBe("31.5");
    expect(formatCompact(1234, "en-US")).toBe("1.2K");
    expect(formatCompact(-12, "en-US")).toBe("-12");
  });

  test("full keeps two decimals and the locale's separators", () => {
    expect(formatFull(1234.567, "en-US")).toBe("1,234.57");
    expect(formatFull(1234.5, "de-DE")).toBe("1.234,5");
  });

  test("an unknown locale falls back instead of throwing", () => {
    expect(formatFull(12.5, "not a locale!!")).toBe("12.5");
  });

  test("ticks carry as many decimals as their step needs", () => {
    expect(formatTick(0.25, 0.25, "en-US")).toBe("0.25");
    expect(formatTick(2, 0.5, "en-US")).toBe("2.0");
    expect(formatTick(40, 20, "en-US")).toBe("40");
    expect(formatTick(2500, 500, "en-US")).toBe("2.5K");
  });

  test("percent shows a decimal only for small shares", () => {
    expect(formatPercent(0.425, "en-US")).toBe("43%");
    expect(formatPercent(0.034, "en-US")).toBe("3.4%");
  });
});

describe("timestamps", () => {
  test("zone-less text is a wall-clock label and is never shifted by the viewer's zone", () => {
    const point = parseTimestamp("2026-03-01T00:00:00.000");
    expect(point?.naive).toBe(true);
    expect(formatTimeLabel(point!, "day", { locale: "en-US", timeZone: "Pacific/Auckland" }, false)).toBe(
      "Mar 1"
    );
    expect(formatTimeFull(point!, "month", { locale: "en-US", timeZone: "America/Los_Angeles" })).toBe(
      "March 2026"
    );
  });

  test("text with a zone is shown in the host's zone", () => {
    const point = parseTimestamp("2026-03-01T23:30:00Z");
    expect(point?.naive).toBe(false);
    expect(formatTimeLabel(point!, "day", { locale: "en-US", timeZone: "Pacific/Auckland" }, false)).toBe(
      "Mar 2"
    );
  });

  test("formats every granularity", () => {
    const point = parseTimestamp("2026-05-04T14:00:00.000")!;
    const context = { locale: "en-US" };
    expect(formatTimeLabel(point, "hour", context, false)).toBe("May 4, 2 PM");
    expect(formatTimeLabel(point, "week", context, true)).toBe("May 4, 26");
    expect(formatTimeLabel(point, "month", context, false)).toBe("May");
    expect(formatTimeLabel(point, "month", context, true)).toBe("May 2026");
    expect(formatTimeLabel(point, "quarter", context, false)).toBe("Q2 2026");
    expect(formatTimeLabel(point, "year", context, false)).toBe("2026");
    expect(formatTimeFull(point, "week", context)).toBe("Week of May 4, 2026");
    expect(formatTimeFull(point, "day", context)).toBe("Mon, May 4, 2026");
    expect(formatTimeFull(point, "hour", context)).toContain("2:00");
  });

  test("rejects text that is not a timestamp", () => {
    expect(parseTimestamp("positive")).toBeUndefined();
    expect(parseTimestamp(null)).toBeUndefined();
    expect(parseTimestamp(5)).toBeUndefined();
    expect(parseTimestamp("")).toBeUndefined();
  });

  test("a typed calendar date has no zone shift", () => {
    expect(formatCalendarDate("2026-01-31", { locale: "en-US", timeZone: "Pacific/Kiritimati" })).toBe(
      "Jan 31, 2026"
    );
    expect(formatCalendarDate("nonsense", {})).toBe("nonsense");
  });
});

describe("humanizeValue", () => {
  test("names empty groups for what they are", () => {
    expect(humanizeValue("FeedbackRecords.sentiment", null)).toBe("Not enriched");
    expect(humanizeValue("FeedbackRecords.sentiment", "  ")).toBe("Not enriched");
    expect(humanizeValue("FeedbackRecords.language", "")).toBe("Unspecified");
    expect(humanizeValue("FeedbackRecords.fieldLabel", null)).toBe("None");
  });

  test("turns the enum tokens into sentence case and leaves everything else as sent", () => {
    expect(humanizeValue("FeedbackRecords.sentiment", "very_negative")).toBe("Very negative");
    expect(humanizeValue("FeedbackRecords.valueBand", "promoter")).toBe("Promoters");
    expect(humanizeValue("FeedbackRecords.fieldLabel", "How was  it?")).toBe("How was it?");
    expect(humanizeValue("FeedbackRecords.sourceType", "some_token")).toBe("some_token");
  });

  test("renders booleans and numbers", () => {
    expect(humanizeValue("FeedbackRecords.metadataFinished", true)).toBe("Yes");
    expect(humanizeValue("FeedbackRecords.valueNumber", 9, "en-US")).toBe("9");
  });
});
