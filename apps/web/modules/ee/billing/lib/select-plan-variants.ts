export const PLAN_VARIANTS = {
  a: {
    showFeatures: true,
    showLogos: true,
  },
  b: {
    showFeatures: true,
    showLogos: true,
  },
} as const satisfies Record<
  string,
  {
    showFeatures: boolean;
    showLogos: boolean;
  }
>;

export type TPlanVariant = keyof typeof PLAN_VARIANTS;
