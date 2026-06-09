import type { TStandardCloudPlan } from "./stripe-billing-catalog";

export type TResponsePricingTier = {
  firstUnit: number;
  lastUnit: number | null;
  perUnitCents: number;
};

export const PRO_RESPONSE_PRICING_TIERS: TResponsePricingTier[] = [
  { firstUnit: 0, lastUnit: 2_000, perUnitCents: 0 },
  { firstUnit: 2_001, lastUnit: 5_000, perUnitCents: 8 },
  { firstUnit: 5_001, lastUnit: 7_500, perUnitCents: 7 },
  { firstUnit: 7_501, lastUnit: 10_000, perUnitCents: 6 },
  { firstUnit: 10_001, lastUnit: 15_000, perUnitCents: 5 },
  { firstUnit: 15_001, lastUnit: 20_000, perUnitCents: 4 },
  { firstUnit: 20_001, lastUnit: 50_000, perUnitCents: 3 },
  { firstUnit: 50_001, lastUnit: null, perUnitCents: 2 },
];

export const SCALE_RESPONSE_PRICING_TIERS: TResponsePricingTier[] = [
  { firstUnit: 0, lastUnit: 5_000, perUnitCents: 0 },
  { firstUnit: 5_001, lastUnit: 7_500, perUnitCents: 6 },
  { firstUnit: 7_501, lastUnit: 10_000, perUnitCents: 5 },
  { firstUnit: 10_001, lastUnit: 15_000, perUnitCents: 4 },
  { firstUnit: 15_001, lastUnit: 20_000, perUnitCents: 3 },
  { firstUnit: 20_001, lastUnit: 50_000, perUnitCents: 2 },
  { firstUnit: 50_001, lastUnit: null, perUnitCents: 1 },
];

export const getResponsePricingTiers = (plan: Extract<TStandardCloudPlan, "pro" | "scale">) => {
  return plan === "pro" ? PRO_RESPONSE_PRICING_TIERS : SCALE_RESPONSE_PRICING_TIERS;
};
