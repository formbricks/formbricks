export const PLAN_VARIANTS = ["control", "gifted_pro"] as const;

export type TPlanVariant = (typeof PLAN_VARIANTS)[number];
