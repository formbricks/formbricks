import { describe, expect, test } from "vitest";
import { getCreativeDisplayState } from "./display-status";
import { DISPLAY_STATUS_CASES, DISPLAY_STATUS_NOW } from "./display-status-cases";

describe("getCreativeDisplayState", () => {
  test.each(DISPLAY_STATUS_CASES)("$name", ({ input, expected }) => {
    expect(getCreativeDisplayState(input, DISPLAY_STATUS_NOW)).toEqual(expected);
  });
});
