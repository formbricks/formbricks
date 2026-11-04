import { describe, expect, test } from "vitest";
import { displayEmbeddedFieldValue, displayEmbeddedValue } from "./value-display";

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

describe("displayEmbeddedFieldValue: a stored value as its field's type reads (P65)", () => {
  test("a date field set by now() keeps its time, with the stored value as the tooltip", () => {
    expect(displayEmbeddedFieldValue("2026-11-04T10:12:30.000Z", "date", "en-GB", "UTC")).toEqual({
      text: "4 Nov 2026, 10:12",
      title: "2026-11-04T10:12:30.000Z",
    });
  });

  test("a date field holding a day reads as that day", () => {
    expect(displayEmbeddedFieldValue("2026-11-04", "date", "en-US", "Pacific/Honolulu")).toEqual({
      text: "Nov 4, 2026",
      title: "2026-11-04",
    });
  });

  test("anything else reads as displayEmbeddedValue has it", () => {
    expect(displayEmbeddedFieldValue("not a date", "date", "en-US")).toEqual({ text: "not a date" });
    expect(displayEmbeddedFieldValue("2026-11-04", "string", "en-US")).toEqual({ text: "2026-11-04" });
    expect(displayEmbeddedFieldValue(42, "number", "en-US")).toEqual({ text: "42" });
    expect(displayEmbeddedFieldValue(undefined, "date", "en-US")).toBeNull();
  });
});
