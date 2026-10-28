import { describe, expect, test } from "vitest";
import { formatDateTime, formatDuration, formatNumber, typeLabel } from "./format";

describe("formatDateTime", () => {
  const iso = "2026-03-14T23:30:00.000Z";

  test("uses the host's locale and time zone", () => {
    expect(formatDateTime(iso, { locale: "en-US", timeZone: "UTC" })).toContain("Mar 14, 2026");
    // 23:30 UTC is already the next day in Kolkata.
    expect(formatDateTime(iso, { locale: "en-US", timeZone: "Asia/Kolkata" })).toContain("Mar 15, 2026");
    expect(formatDateTime(iso, { locale: "de-DE", timeZone: "UTC" })).toContain("14.03.2026");
  });

  test("falls back instead of throwing on a locale or zone Intl rejects, and echoes an invalid date", () => {
    expect(formatDateTime(iso, { locale: "not a locale!!", timeZone: "Nope/Zone" })).toContain("2026");
    expect(formatDateTime("garbage", { locale: "en-US", timeZone: "UTC" })).toBe("garbage");
  });
});

describe("formatNumber", () => {
  test("groups digits by locale", () => {
    expect(formatNumber(12345, { locale: "en-US", timeZone: "UTC" })).toBe("12,345");
    expect(formatNumber(12345, { locale: "de-DE", timeZone: "UTC" })).toBe("12.345");
  });
});

describe("formatDuration", () => {
  test("reads in seconds, minutes and hours", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(75)).toBe("1m 15s");
    expect(formatDuration(3725)).toBe("1h 2m");
  });
});

describe("typeLabel", () => {
  test("names known element types and never leaks an unknown one", () => {
    expect(typeLabel("multipleChoiceSingle")).toBe("Single choice");
    expect(typeLabel("somethingNew")).toBe("Question");
  });
});
