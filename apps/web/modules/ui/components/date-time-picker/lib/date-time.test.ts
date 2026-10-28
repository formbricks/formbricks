import { describe, expect, test } from "vitest";
import {
  combineDayAndTime,
  formatTimeText,
  getDayPeriodMarkers,
  getEditorTimeZone,
  getTimeParts,
  getTimeTextState,
  isBeforeDay,
  parseTimeText,
  resolveDefaultDay,
  validateDateTimeRange,
} from "./date-time";

// The locales the app ships (apps/web/locales). Typed entry has to accept what the picker itself shows.
const APP_LOCALES = [
  "de-DE",
  "en-US",
  "es-ES",
  "fr-FR",
  "hu-HU",
  "ja-JP",
  "nl-NL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sv-SE",
  "tr-TR",
  "zh-Hans-CN",
  "zh-Hant-TW",
];

describe("parseTimeText", () => {
  const markers = getDayPeriodMarkers("en-US");

  test("reads 24-hour times", () => {
    expect(parseTimeText("02:05", markers)).toEqual({ hours: 2, minutes: 5 });
    expect(parseTimeText("23:59", markers)).toEqual({ hours: 23, minutes: 59 });
    expect(parseTimeText("0:00", markers)).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeText(" 9:30 ", markers)).toEqual({ hours: 9, minutes: 30 });
  });

  test("reads 12-hour times with a day period, however it is typed", () => {
    expect(parseTimeText("12:00 AM", markers)).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeText("11:59 PM", markers)).toEqual({ hours: 23, minutes: 59 });
    expect(parseTimeText("11:59pm", markers)).toEqual({ hours: 23, minutes: 59 });
    expect(parseTimeText("12:30 pm", markers)).toEqual({ hours: 12, minutes: 30 });
    expect(parseTimeText("2:05 a.m.", markers)).toEqual({ hours: 2, minutes: 5 });
    expect(parseTimeText("2 PM", markers)).toEqual({ hours: 14, minutes: 0 });
    expect(parseTimeText("2:30 p", markers)).toEqual({ hours: 14, minutes: 30 });
  });

  test("reads an hour alone and compact digits", () => {
    expect(parseTimeText("9", markers)).toEqual({ hours: 9, minutes: 0 });
    expect(parseTimeText("930", markers)).toEqual({ hours: 9, minutes: 30 });
    expect(parseTimeText("0930", markers)).toEqual({ hours: 9, minutes: 30 });
    expect(parseTimeText("2359", markers)).toEqual({ hours: 23, minutes: 59 });
  });

  test("accepts the narrow and plain no-break spaces Intl puts before a day period", () => {
    const narrow = String.fromCharCode(0x202f);
    const plain = String.fromCharCode(0x00a0);
    expect(parseTimeText(`11:59${narrow}PM`, markers)).toEqual({ hours: 23, minutes: 59 });
    expect(parseTimeText(`11:59${plain}PM`, markers)).toEqual({ hours: 23, minutes: 59 });
  });

  test("rejects empty, malformed and out-of-range input", () => {
    expect(parseTimeText("", markers)).toBeNull();
    expect(parseTimeText("   ", markers)).toBeNull();
    expect(parseTimeText("ab:cd", markers)).toBeNull();
    expect(parseTimeText("14:", markers)).toBeNull();
    expect(parseTimeText("14:3", markers)).toBeNull();
    expect(parseTimeText("24:00", markers)).toBeNull();
    expect(parseTimeText("12:60", markers)).toBeNull();
    expect(parseTimeText("12345", markers)).toBeNull();
  });

  test("rejects an impossible 12-hour clock reading", () => {
    expect(parseTimeText("13:00 PM", markers)).toBeNull();
    expect(parseTimeText("0:30 AM", markers)).toBeNull();
  });
});

describe("formatTimeText and parseTimeText", () => {
  const times = [
    { hours: 0, minutes: 0 },
    { hours: 9, minutes: 5 },
    { hours: 12, minutes: 0 },
    { hours: 12, minutes: 30 },
    { hours: 14, minutes: 30 },
    { hours: 23, minutes: 59 },
  ];

  test.each(APP_LOCALES)("%s: typed entry accepts what the picker displays", (locale) => {
    const markers = getDayPeriodMarkers(locale);
    for (const time of times) {
      const shown = formatTimeText(new Date(2026, 9, 15, time.hours, time.minutes), locale);
      expect(parseTimeText(shown, markers), `${locale} shows "${shown}"`).toEqual(time);
    }
  });

  test("shows the time the way the app locale writes it", () => {
    expect(formatTimeText(new Date(2026, 11, 7, 23, 59), "en-US").replace(/\s/g, " ")).toBe("11:59 PM");
    expect(formatTimeText(new Date(2026, 11, 7, 23, 59), "de-DE")).toBe("23:59");
  });
});

describe("getTimeTextState", () => {
  const markers = getDayPeriodMarkers("en-US");

  test.each(["9:30", "11:59 PM", "2pm", "930", "23:59"])("%s is valid", (text) => {
    expect(getTimeTextState(text, markers)).toBe("valid");
  });

  test.each(["", "  ", "9:", "9:3", "12:", "p", "a.", "11:30 a."])("%s is still being typed", (text) => {
    expect(getTimeTextState(text, markers)).not.toBe("invalid");
  });

  test.each(["qewqeqweqw", "8:00 AMqwe", "12345", "9:75", "24:00", "13:00 pm", "9:30x", "x9"])(
    "%s can't become a time",
    (text) => {
      expect(getTimeTextState(text, markers)).toBe("invalid");
    }
  );

  test.each(APP_LOCALES)("%s: no keystroke of a time the picker shows reads as an error", (locale) => {
    const localeMarkers = getDayPeriodMarkers(locale);
    for (const hours of [0, 9, 12, 14, 23]) {
      const shown = formatTimeText(new Date(2026, 9, 15, hours, 30), locale);
      for (let length = 0; length <= shown.length; length++) {
        const typed = shown.slice(0, length);
        expect(getTimeTextState(typed, localeMarkers), `${locale} typing "${typed}"`).not.toBe("invalid");
      }
    }
  });
});

describe("getDayPeriodMarkers", () => {
  test("always understands the English markers, in any locale", () => {
    for (const locale of ["de-DE", "ja-JP", undefined]) {
      const markers = getDayPeriodMarkers(locale);
      expect(markers.am).toEqual(expect.arrayContaining(["am", "a"]));
      expect(markers.pm).toEqual(expect.arrayContaining(["pm", "p"]));
    }
  });

  test("adds the locale's own markers, with dots and spaces dropped", () => {
    expect(getDayPeriodMarkers("ja-JP")).toEqual({
      am: expect.arrayContaining(["午前"]),
      pm: expect.arrayContaining(["午後"]),
    });
    expect(getDayPeriodMarkers("es-ES").am).toContain("am");
  });
});

describe("combineDayAndTime", () => {
  test("keeps the calendar day and sets the local time, zeroing seconds", () => {
    const day = new Date(2026, 9, 15, 17, 42, 31, 999);
    const result = combineDayAndTime(day, { hours: 0, minutes: 0 });
    expect(result).toEqual(new Date(2026, 9, 15, 0, 0, 0, 0));
  });
});

describe("getTimeParts", () => {
  test("returns local time parts, or midnight without a date", () => {
    expect(getTimeParts(new Date(2026, 9, 15, 4, 0))).toEqual({ hours: 4, minutes: 0 });
    expect(getTimeParts(null)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe("resolveDefaultDay", () => {
  const now = new Date(2026, 9, 15, 17, 42);

  test("is today when nothing bounds it", () => {
    expect(resolveDefaultDay(now)).toEqual(new Date(2026, 9, 15));
  });

  test("is the first pickable day when the bound is still ahead", () => {
    expect(resolveDefaultDay(now, new Date(2026, 11, 7, 9, 30))).toEqual(new Date(2026, 11, 7));
  });

  test("is today when the bound is already behind", () => {
    expect(resolveDefaultDay(now, new Date(2026, 9, 1))).toEqual(new Date(2026, 9, 15));
  });
});

describe("isBeforeDay", () => {
  const bound = new Date(2026, 9, 15, 12, 0);

  test("compares whole days, ignoring the time of day", () => {
    expect(isBeforeDay(new Date(2026, 9, 14, 23, 59), bound)).toBe(true);
    expect(isBeforeDay(new Date(2026, 9, 15, 0, 0), bound)).toBe(false);
    expect(isBeforeDay(new Date(2026, 9, 16), bound)).toBe(false);
  });

  test("nothing is before an absent bound", () => {
    expect(isBeforeDay(new Date(2026, 0, 1))).toBe(false);
  });
});

describe("getEditorTimeZone", () => {
  test("names a zone Intl accepts, so the label can be shown as written", () => {
    const zone = getEditorTimeZone();
    expect(zone).not.toBe("");
    expect(() => new Intl.DateTimeFormat("en-US", { timeZone: zone })).not.toThrow();
  });
});

describe("validateDateTimeRange", () => {
  const start = new Date(2026, 9, 15, 2, 0);

  test("accepts an end after the start, and open bounds", () => {
    expect(validateDateTimeRange(start, new Date(2026, 9, 15, 4, 0))).toBeNull();
    expect(validateDateTimeRange(null, start)).toBeNull();
    expect(validateDateTimeRange(start, null)).toBeNull();
    expect(validateDateTimeRange(null, null)).toBeNull();
  });

  test("rejects an end before or equal to the start", () => {
    expect(validateDateTimeRange(start, new Date(2026, 9, 15, 1, 59))).toBe("end_before_start");
    expect(validateDateTimeRange(start, new Date(start))).toBe("end_before_start");
  });

  test("the ticket's own schedule is valid, and flipping it is not", () => {
    const oct15 = new Date(2026, 9, 15, 0, 0);
    const dec7 = new Date(2026, 11, 7, 23, 59);
    expect(validateDateTimeRange(oct15, dec7)).toBeNull();
    expect(validateDateTimeRange(dec7, oct15)).toBe("end_before_start");
  });
});
