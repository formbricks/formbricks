import { describe, expect, test } from "vitest";
import { createFormatters } from "./formatters";

describe("createFormatters", () => {
  test("formats dates and numbers in the host's locale and time zone", () => {
    const format = createFormatters({ locale: "de-DE", timeZone: "UTC" });
    expect(format.date("2026-12-31T23:00:00.000Z")).toContain("31.12.2026");
    expect(format.number(1000)).toBe("1.000");
  });

  test("returns an unparseable date unchanged", () => {
    expect(createFormatters({ locale: "en-US", timeZone: "UTC" }).date("soon")).toBe("soon");
  });
});
