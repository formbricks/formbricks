import { describe, expect, test } from "vitest";
import { findElementByIdOrCode } from "./element-lookup";

const elements = [
  { id: "abc123", code: "q1" },
  { id: "q1", code: "legacy" },
  { id: "xyz789", code: "age" },
  { id: "nocode" },
];

describe("findElementByIdOrCode", () => {
  test("resolves a Question ID", () => {
    expect(findElementByIdOrCode(elements, "xyz789")?.id).toBe("xyz789");
  });

  test("resolves a question code", () => {
    expect(findElementByIdOrCode(elements, "age")?.id).toBe("xyz789");
  });

  test("the ID wins when a legacy ID equals another question's code", () => {
    expect(findElementByIdOrCode(elements, "q1")?.id).toBe("q1");
  });

  test("returns undefined for an unknown name", () => {
    expect(findElementByIdOrCode(elements, "nope")).toBeUndefined();
  });

  test("an element without a code never matches a missing or empty name", () => {
    expect(findElementByIdOrCode(elements, "undefined")).toBeUndefined();
    expect(findElementByIdOrCode(elements, "")).toBeUndefined();
  });

  test("codes are matched exactly, not case-insensitively", () => {
    expect(findElementByIdOrCode(elements, "AGE")).toBeUndefined();
  });
});
