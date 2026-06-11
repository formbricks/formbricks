import type Stripe from "stripe";
import { describe, expect, test } from "vitest";
import { mapStripeTiersToResponsePricingTiers } from "./response-pricing-tiers";

const tier = (overrides: Partial<Stripe.Price.Tier>): Stripe.Price.Tier => ({
  flat_amount: null,
  flat_amount_decimal: null,
  unit_amount: null,
  unit_amount_decimal: null,
  up_to: null,
  ...overrides,
});

describe("mapStripeTiersToResponsePricingTiers", () => {
  test("maps graduated Stripe tiers to contiguous first/last unit ranges", () => {
    const result = mapStripeTiersToResponsePricingTiers([
      tier({ up_to: 2_000, unit_amount: 0 }),
      tier({ up_to: 5_000, unit_amount: 8 }),
      tier({ up_to: null, unit_amount: 2 }),
    ]);

    expect(result).toEqual([
      { firstUnit: 0, lastUnit: 2_000, perUnitCents: 0 },
      { firstUnit: 2_001, lastUnit: 5_000, perUnitCents: 8 },
      { firstUnit: 5_001, lastUnit: null, perUnitCents: 2 },
    ]);
  });

  test("falls back to unit_amount_decimal for fractional cent prices", () => {
    const result = mapStripeTiersToResponsePricingTiers([
      tier({ up_to: 1_000, unit_amount: 0 }),
      tier({ up_to: null, unit_amount_decimal: "0.5" }),
    ]);

    expect(result).toEqual([
      { firstUnit: 0, lastUnit: 1_000, perUnitCents: 0 },
      { firstUnit: 1_001, lastUnit: null, perUnitCents: 0.5 },
    ]);
  });

  test("returns null when tiers are missing or empty", () => {
    expect(mapStripeTiersToResponsePricingTiers(undefined)).toBeNull();
    expect(mapStripeTiersToResponsePricingTiers([])).toBeNull();
  });

  test("returns null when a non-final tier is unbounded", () => {
    expect(
      mapStripeTiersToResponsePricingTiers([
        tier({ up_to: null, unit_amount: 8 }),
        tier({ up_to: 5_000, unit_amount: 2 }),
      ])
    ).toBeNull();
  });

  test("returns null when a tier has no usable unit amount", () => {
    expect(
      mapStripeTiersToResponsePricingTiers([tier({ up_to: 2_000, unit_amount: 0 }), tier({ up_to: null })])
    ).toBeNull();
  });
});
