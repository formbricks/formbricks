export enum ProductFeatureKeys {
  free = "free",
  startup = "startup",
  scale = "scale",
  enterprise = "enterprise",
}

export enum StripeProductNames {
  startup = "Formbricks Startup",
  scale = "Formbricks Scale",
  enterprise = "Formbricks Enterprise",
}
export enum StripePriceLookupKeys {
  startupMonthly = "formbricks_startup_monthly",
  startupYearly = "formbricks_startup_yearly",
  scaleMonthly = "formbricks_scale_monthly",
  scaleYearly = "formbricks_scale_yearly",
}

export const LIMITS = {
  FREE: {
    RESPONSES: 500,
    MIU: 1000,
  },
};
