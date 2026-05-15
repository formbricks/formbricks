import { describe, expect, test } from "vitest";
import { PLAN_VARIANTS, type TPlanVariant } from "./select-plan-variants";

const VARIANTS = Object.keys(PLAN_VARIANTS) as TPlanVariant[];

describe("PLAN_VARIANTS", () => {
  test("contains exactly the expected variants", () => {
    expect(VARIANTS).toEqual(["a", "b"]);
  });

  test.each(VARIANTS)("variant %s has required boolean flags", (variant) => {
    const config = PLAN_VARIANTS[variant];
    expect(typeof config.showFeatures).toBe("boolean");
    expect(typeof config.showLogos).toBe("boolean");
  });

  test("variant a shows features and logos", () => {
    expect(PLAN_VARIANTS.a.showFeatures).toBe(true);
    expect(PLAN_VARIANTS.a.showLogos).toBe(true);
  });

  test("variant b shows features and logos", () => {
    expect(PLAN_VARIANTS.b.showFeatures).toBe(true);
    expect(PLAN_VARIANTS.b.showLogos).toBe(true);
  });
});
