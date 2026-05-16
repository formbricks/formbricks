import { describe, expect, test } from "vitest";
import { PLAN_VARIANTS, type TPlanVariant } from "./select-plan-variants";

describe("PLAN_VARIANTS", () => {
  test("contains exactly the expected variants", () => {
    expect(PLAN_VARIANTS).toEqual(["a", "b"]);
  });

  test("TPlanVariant covers all entries", () => {
    const variants: TPlanVariant[] = [...PLAN_VARIANTS];
    expect(variants).toHaveLength(2);
  });
});
