import { describe, expect, test } from "vitest";
import {
  PRO_RESPONSE_PRICING_TIERS,
  SCALE_RESPONSE_PRICING_TIERS,
  getResponsePricingTiers,
} from "./response-pricing-tiers";

describe("getResponsePricingTiers", () => {
  test("returns pro tiers for pro plan", () => {
    expect(getResponsePricingTiers("pro")).toBe(PRO_RESPONSE_PRICING_TIERS);
  });

  test("returns scale tiers for scale plan", () => {
    expect(getResponsePricingTiers("scale")).toBe(SCALE_RESPONSE_PRICING_TIERS);
  });

  test("pro tiers start free and end with unlimited top tier", () => {
    expect(PRO_RESPONSE_PRICING_TIERS[0]).toEqual({ firstUnit: 0, lastUnit: 2_000, perUnitCents: 0 });
    expect(PRO_RESPONSE_PRICING_TIERS.at(-1)).toEqual({ firstUnit: 50_001, lastUnit: null, perUnitCents: 2 });
  });

  test("scale tiers start free and end with unlimited top tier", () => {
    expect(SCALE_RESPONSE_PRICING_TIERS[0]).toEqual({ firstUnit: 0, lastUnit: 5_000, perUnitCents: 0 });
    expect(SCALE_RESPONSE_PRICING_TIERS.at(-1)).toEqual({
      firstUnit: 50_001,
      lastUnit: null,
      perUnitCents: 1,
    });
  });
});
