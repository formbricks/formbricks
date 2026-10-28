import { describe, expect, test } from "vitest";
import { formatDuration, typeLabel } from "./format";

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
