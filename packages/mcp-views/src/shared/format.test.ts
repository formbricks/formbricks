import { describe, expect, test } from "vitest";
import { formatDateTime, formatNumber } from "./format";

describe("formatDateTime", () => {
  const iso = "2026-10-28T09:05:00Z";

  test("uses the host's locale and time zone", () => {
    expect(formatDateTime(iso, { locale: "en-US", timeZone: "UTC" })).toBe("Oct 28, 2026, 9:05 AM");
    expect(formatDateTime(iso, { locale: "en-US", timeZone: "Asia/Tokyo" })).toBe("Oct 28, 2026, 6:05 PM");
    expect(formatDateTime(iso, { locale: "de-DE", timeZone: "UTC" })).toContain("28.10.2026");
  });

  test("falls back to en-US and UTC when the host's values are unknown", () => {
    expect(formatDateTime(iso, { locale: "not a locale", timeZone: "Nowhere/Land" })).toBe(
      "Oct 28, 2026, 9:05 AM"
    );
  });

  test("returns text that is not a date unchanged", () => {
    expect(formatDateTime("yesterday")).toBe("yesterday");
  });
});

describe("formatNumber", () => {
  test("groups digits by the host's locale", () => {
    expect(formatNumber(1234567.5, { locale: "en-US" })).toBe("1,234,567.5");
    expect(formatNumber(1234567.5, { locale: "de-DE" })).toBe("1.234.567,5");
  });

  test("falls back to en-US for an unknown locale and for none", () => {
    expect(formatNumber(1234, { locale: "not a locale" })).toBe("1,234");
    expect(formatNumber(1234)).toBe("1,234");
  });

  test("passes options through", () => {
    expect(formatNumber(0.25, { locale: "en-US" }, { style: "percent" })).toBe("25%");
  });
});
