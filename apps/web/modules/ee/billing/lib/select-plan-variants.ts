export const PLAN_VARIANTS = ["a", "b"] as const;

export type TPlanVariant = (typeof PLAN_VARIANTS)[number];
