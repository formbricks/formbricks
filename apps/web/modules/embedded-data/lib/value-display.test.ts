import { describe, expect, test } from "vitest";
import { displayEmbeddedValue } from "./value-display";

describe("displayEmbeddedValue", () => {
  test("shows a stored number, which is the value that used to disappear", () => {
    // The regression: a `number` field stores a JSON number, and every surface reading a stored value
    // tested `typeof value === "string"`, so `42` rendered as nothing while the export wrote `42`.
    expect(displayEmbeddedValue(42)).toBe("42");
    expect(displayEmbeddedValue(0)).toBe("0");
    expect(displayEmbeddedValue(-1.5)).toBe("-1.5");
    expect(displayEmbeddedValue("gold")).toBe("gold");
  });

  test("shows a boolean, though nothing stores one", () => {
    // `ZResponseDataValue` has no boolean member — a boolean-typed field is stored as `"true"` /
    // `"false"` and took the string arm above even before this helper existed. Pinned so the arm is
    // not mistaken for the fix, and so removing it stays a deliberate choice rather than a silent one.
    expect(displayEmbeddedValue(true)).toBe("true");
    expect(displayEmbeddedValue(false)).toBe("false");
  });

  test("an empty string is a present value, not an absent one", () => {
    // Distinct from `null` on purpose: callers that skip blanks decide that for themselves, and this
    // is what keeps them skipping exactly what they skipped before.
    expect(displayEmbeddedValue("")).toBe("");
  });

  test("nothing to show for an absent value", () => {
    expect(displayEmbeddedValue(null)).toBeNull();
    expect(displayEmbeddedValue(undefined)).toBeNull();
  });

  test("nothing to show for a value that is not this field's", () => {
    // `response.data` is shared with element answers, so a collection under a field's storage key
    // means the key collided with an element id.
    expect(displayEmbeddedValue(["a", "b"])).toBeNull();
    expect(displayEmbeddedValue({ row: "answer" })).toBeNull();
  });

  test("nothing to show for a number that cannot be written down", () => {
    expect(displayEmbeddedValue(Number.NaN)).toBeNull();
    expect(displayEmbeddedValue(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
