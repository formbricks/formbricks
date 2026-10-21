import { describe, expect, test } from "vitest";
import { PHONE_FRAME, getPhoneScale } from "./phone-viewport";

describe("phone viewport", () => {
  test("scales the whole device down to fit the pane, by the tighter side", () => {
    const halfHeight = { width: PHONE_FRAME.width * 2, height: PHONE_FRAME.height / 2 };
    const halfWidth = { width: PHONE_FRAME.width / 2, height: PHONE_FRAME.height * 2 };

    expect(getPhoneScale(halfHeight)).toBeCloseTo(0.5);
    expect(getPhoneScale(halfWidth)).toBeCloseTo(0.5);
  });

  test("never draws the phone larger than life, and never at a size it can't show", () => {
    expect(getPhoneScale({ width: 4000, height: 4000 })).toBe(1);
    expect(getPhoneScale({ width: 0, height: 600 })).toBe(0);
    expect(getPhoneScale({ width: -10, height: 600 })).toBe(0);
  });
});
