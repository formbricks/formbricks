import { describe, expect, test } from "vitest";
import {
  BOOLEAN_SET_VALUE_FALSE,
  BOOLEAN_SET_VALUE_TRUE,
  getBooleanSetValueSelection,
  toBooleanSetValue,
} from "./boolean-set-value";

describe("true/false Set value row (ENG-6973)", () => {
  test("stores True and False as real booleans", () => {
    expect(toBooleanSetValue(BOOLEAN_SET_VALUE_TRUE, "static")).toEqual({ type: "static", value: true });
    expect(toBooleanSetValue(BOOLEAN_SET_VALUE_FALSE, "static")).toEqual({ type: "static", value: false });
  });

  test("stores a true/false field as its reference", () => {
    expect(toBooleanSetValue("is_pro", "hiddenField")).toEqual({ type: "hiddenField", value: "is_pro" });
    expect(toBooleanSetValue("flag", "variable")).toEqual({ type: "variable", value: "flag" });
  });

  test("a field whose key is `false` stays a reference, apart from the literal", () => {
    expect(toBooleanSetValue("false", "hiddenField")).toEqual({ type: "hiddenField", value: "false" });
    expect(getBooleanSetValueSelection({ type: "hiddenField", value: "false" })).toBe("false");
    expect(getBooleanSetValueSelection({ type: "static", value: false })).not.toBe("false");
  });

  test("stores nothing for free text or a question", () => {
    expect(toBooleanSetValue("yes", "static")).toBeUndefined();
    expect(toBooleanSetValue("true", "static")).toBeUndefined();
    expect(toBooleanSetValue("q1", "element")).toBeUndefined();
    expect(toBooleanSetValue("x", undefined)).toBeUndefined();
  });

  test("shows the stored value as the option it was picked from", () => {
    expect(getBooleanSetValueSelection({ type: "static", value: true })).toBe(BOOLEAN_SET_VALUE_TRUE);
    expect(getBooleanSetValueSelection({ type: "static", value: false })).toBe(BOOLEAN_SET_VALUE_FALSE);
    expect(getBooleanSetValueSelection({ type: "variable", value: "flag" })).toBe("flag");
    // A step just switched to this field has nothing picked yet.
    expect(getBooleanSetValueSelection({ type: "static", value: "" })).toBe("");
  });
});
