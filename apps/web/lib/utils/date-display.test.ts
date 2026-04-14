import { describe, expect, test } from "vitest";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { formatStoredDateForDisplay, getSurveyDateFormatMap, parseStoredDateValue } from "./date-display";

describe("date display utils", () => {
  test("parses ISO stored dates", () => {
    const parsedDate = parseStoredDateValue("2025-05-06");

    expect(parsedDate).not.toBeNull();
    expect(parsedDate?.getFullYear()).toBe(2025);
    expect(parsedDate?.getMonth()).toBe(4);
    expect(parsedDate?.getDate()).toBe(6);
  });

  test("parses legacy stored dates using the element format", () => {
    const parsedDate = parseStoredDateValue("5-6-2025", "M-d-y");

    expect(parsedDate).not.toBeNull();
    expect(parsedDate?.getFullYear()).toBe(2025);
    expect(parsedDate?.getMonth()).toBe(4);
    expect(parsedDate?.getDate()).toBe(6);
  });

  test("parses day-first stored dates when no format is provided", () => {
    const parsedDate = parseStoredDateValue("06-05-2025");

    expect(parsedDate).not.toBeNull();
    expect(parsedDate?.getFullYear()).toBe(2025);
    expect(parsedDate?.getMonth()).toBe(4);
    expect(parsedDate?.getDate()).toBe(6);
  });

  test("formats stored dates using the selected locale", () => {
    const date = new Date(2025, 4, 6);

    expect(formatStoredDateForDisplay("2025-05-06", undefined, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date)
    );
  });

  test("returns null for invalid stored dates", () => {
    expect(formatStoredDateForDisplay("2025-02-30", "y-M-d")).toBeNull();
  });

  test("builds a date format map for survey date elements", () => {
    const elements = [
      {
        id: "dateQuestion",
        type: "date",
        format: "d-M-y",
      },
      {
        id: "textQuestion",
        type: "openText",
      },
    ] as TSurveyElement[];

    expect(getSurveyDateFormatMap(elements)).toEqual({
      dateQuestion: "d-M-y",
    });
  });
});
