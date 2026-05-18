export const PLAN_VARIANTS = ["control", "variant_b", "variant_c"] as const;

export type TPlanVariant = (typeof PLAN_VARIANTS)[number];
