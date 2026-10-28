import { describe, expect, test } from "vitest";
import { createFormatters } from "./formatters";

describe("createFormatters", () => {
  test("formats dates in the host's locale and time zone", () => {
    const format = createFormatters("de-DE", "UTC");
    expect(format.date("2026-12-31T23:00:00.000Z")).toContain("31.12.2026");
    expect(format.number(1000)).toBe("1.000");
  });

  test("falls back instead of throwing on a locale or zone Intl rejects", () => {
    const format = createFormatters("not a locale", "Nowhere/Land");
    expect(() => format.date("2026-01-01T00:00:00.000Z")).not.toThrow();
    expect(format.number(5)).toBe("5");
  });

  test("returns an unparseable date unchanged", () => {
    expect(createFormatters("en-US", "UTC").date("soon")).toBe("soon");
  });
});
