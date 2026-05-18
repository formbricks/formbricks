import { describe, expect, test } from "vitest";
import {
  SURVEY_SCHEDULING_LOCAL_HOUR,
  SURVEY_SCHEDULING_LOCAL_MINUTE,
  SURVEY_SCHEDULING_TIME_ZONE,
} from "./constants";
import {
  getMinimumSurveySchedulingCalendarDate,
  normalizeDateOnlySelectionToSurveySchedulingDateTime,
  toCalendarDate,
  toDateOnlySelection,
} from "./date-utils";

describe("survey scheduling date utils", () => {
  test("stores selected dates as noon UTC date-only values", () => {
    const selectedDate = new Date("2026-04-17T09:15:00.000Z");
    const storedDate = toDateOnlySelection(selectedDate);

    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  test("round-trips stored date-only values back to the selected calendar day", () => {
    const storedDate = new Date("2026-04-17T12:00:00.000Z");
    const calendarDate = toCalendarDate(storedDate);

    expect(calendarDate.getFullYear()).toBe(2026);
    expect(calendarDate.getMonth()).toBe(3);
    expect(calendarDate.getDate()).toBe(17);
    expect(calendarDate.getHours()).toBe(12);
  });

  test("normalizes selected dates to the configured survey scheduling time", () => {
    const storedDate = new Date("2026-01-17T12:00:00.000Z");

    expect(normalizeDateOnlySelectionToSurveySchedulingDateTime(storedDate)?.toISOString()).toBe(
      "2026-01-16T23:00:00.000Z"
    );
  });

  test("keeps already-normalized survey scheduling values stable when re-saved", () => {
    const normalizedStoredDate = new Date("2026-04-16T22:00:00.000Z");
    const calendarDate = toCalendarDate(normalizedStoredDate);
    const reselectedDate = toDateOnlySelection(calendarDate);

    expect(reselectedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
    expect(normalizeDateOnlySelectionToSurveySchedulingDateTime(normalizedStoredDate)?.toISOString()).toBe(
      "2026-04-16T22:00:00.000Z"
    );
    expect(normalizeDateOnlySelectionToSurveySchedulingDateTime(reselectedDate)?.toISOString()).toBe(
      "2026-04-16T22:00:00.000Z"
    );
  });

  test("uses the timezone's DST offset when normalizing summer dates", () => {
    const storedDate = new Date("2026-07-10T12:00:00.000Z");

    expect(normalizeDateOnlySelectionToSurveySchedulingDateTime(storedDate)?.toISOString()).toBe(
      "2026-07-09T22:00:00.000Z"
    );
  });

  test("uses the next schedulable calendar day after today's run time passes", () => {
    const minSelectableDate = getMinimumSurveySchedulingCalendarDate(new Date("2026-04-16T21:30:00.000Z"));

    expect(minSelectableDate.getFullYear()).toBe(2026);
    expect(minSelectableDate.getMonth()).toBe(3);
    expect(minSelectableDate.getDate()).toBe(17);
    expect(minSelectableDate.getHours()).toBe(12);
  });

  test("documents the default scheduling configuration", () => {
    expect(SURVEY_SCHEDULING_TIME_ZONE).toBe("Europe/Berlin");
    expect(SURVEY_SCHEDULING_LOCAL_HOUR).toBe(0);
    expect(SURVEY_SCHEDULING_LOCAL_MINUTE).toBe(0);
  });
});
