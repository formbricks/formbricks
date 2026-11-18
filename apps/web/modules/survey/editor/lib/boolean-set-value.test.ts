import { describe, expect, test } from "vitest";
import { getBooleanSetValueSelection, toBooleanSetValue } from "./boolean-set-value";

describe("true/false Set value row (ENG-6973)", () => {
  test("stores True and False as real booleans", () => {
    expect(toBooleanSetValue("true", "static")).toEqual({ type: "static", value: true });
    expect(toBooleanSetValue("false", "static")).toEqual({ type: "static", value: false });
  });

  test("stores a true/false field as its reference", () => {
    expect(toBooleanSetValue("is_pro", "hiddenField")).toEqual({ type: "hiddenField", value: "is_pro" });
    expect(toBooleanSetValue("flag", "variable")).toEqual({ type: "variable", value: "flag" });
  });

  test("stores nothing for free text or a question", () => {
    expect(toBooleanSetValue("yes", "static")).toBeUndefined();
    expect(toBooleanSetValue("q1", "element")).toBeUndefined();
    expect(toBooleanSetValue("x", undefined)).toBeUndefined();
  });

  test("shows the stored value as the option it was picked from", () => {
    expect(getBooleanSetValueSelection({ type: "static", value: true })).toBe("true");
    expect(getBooleanSetValueSelection({ type: "static", value: false })).toBe("false");
    expect(getBooleanSetValueSelection({ type: "variable", value: "flag" })).toBe("flag");
    // A step just switched to this field has nothing picked yet.
    expect(getBooleanSetValueSelection({ type: "static", value: "" })).toBe("");
  });
});
