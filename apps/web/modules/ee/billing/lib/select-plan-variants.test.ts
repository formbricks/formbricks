import { describe, expect, test } from "vitest";
import { PLAN_VARIANTS, type TPlanVariant } from "./select-plan-variants";

describe("PLAN_VARIANTS", () => {
  test("contains exactly the expected variants", () => {
    expect(PLAN_VARIANTS).toEqual(["control", "variant_b", "variant_c"]);
  });

  test("TPlanVariant covers all entries", () => {
    const variants: TPlanVariant[] = [...PLAN_VARIANTS];
    expect(variants).toHaveLength(3);
  });
});
