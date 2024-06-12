export enum PRODUCT_FEATURE_KEYS {
  FREE = "free",
  STARTUP = "startup",
  SCALE = "scale",
  ENTERPRISE = "enterprise",
}

export enum STRIPE_PRODUCT_NAMES {
  STARTUP = "Formbricks Startup",
  SCALE = "Formbricks Scale",
  ENTERPRISE = "Formbricks Enterprise",
}
export enum STRIPE_PRICE_LOOKUP_KEYS {
  STARTUP_MONTHLY = "formbricks_startup_monthly",
  STARTUP_YEARLY = "formbricks_startup_yearly",
  SCALE_MONTHLY = "formbricks_scale_monthly",
  SCALE_YEARLY = "formbricks_scale_yearly",
}

export const LIMITS = {
  FREE: {
    RESPONSES: 500,
    MIU: 1000,
  },
  STARTUP: {
    RESPONSES: 2000,
    MIU: 2500,
  },
  SCALE: {
    RESPONSES: 5000,
    MIU: 20000,
  },
};
