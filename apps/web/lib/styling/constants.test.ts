import { describe, expect, test } from "vitest";
import { getSuggestedColors } from "./constants";

describe("getSuggestedColors", () => {
  test("always suggests white for card background color", () => {
    const greenBrand = getSuggestedColors("#00ab3b");
    const roseBrand = getSuggestedColors("#e11d48");

    expect(greenBrand["cardBackgroundColor.light"]).toBe("#ffffff");
    expect(roseBrand["cardBackgroundColor.light"]).toBe("#ffffff");
  });
});
