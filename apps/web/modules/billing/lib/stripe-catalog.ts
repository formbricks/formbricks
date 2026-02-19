import { z } from "zod";

export const CLOUD_STRIPE_PRODUCT_IDS = {
  HOBBY: "prod_ToYKB5ESOMZZk5",
  PRO: "prod_ToYKQ8WxS3ecgf",
  SCALE: "prod_ToYLW5uCQTMa6v",
  TRIAL: "prod_TodVcJiEnK5ABK",
} as const;

export const CLOUD_STRIPE_PRICE_LOOKUP_KEYS = {
  HOBBY_MONTHLY: "price_hobby_monthly",
  TRIAL_FREE: "price_trial_free",
  PRO_MONTHLY: "price_pro_monthly",
  PRO_YEARLY: "price_pro_yearly",
  SCALE_MONTHLY: "price_scale_monthly",
  SCALE_YEARLY: "price_scale_yearly",
  PRO_USAGE_RESPONSES: "price_pro_usage_responses",
  SCALE_USAGE_RESPONSES: "price_scale_usage_responses",
} as const;

export const CLOUD_STRIPE_FEATURE_LOOKUP_KEYS = {
  CUSTOM_REDIRECT_URL: "custom-redirect-url",
  CUSTOM_LINKS_IN_SURVEYS: "custom-links-in-surveys",
  FOLLOW_UPS: "follow-ups",
  SPAM_PROTECTION: "spam-protection",
} as const;

export const ZCloudUpgradePriceLookupKey = z.enum([
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY,
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_YEARLY,
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS.SCALE_MONTHLY,
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS.SCALE_YEARLY,
]);

export type TCloudUpgradePriceLookupKey = z.infer<typeof ZCloudUpgradePriceLookupKey>;

export const CLOUD_PLAN_LEVEL = {
  hobby: 0,
  pro: 1,
  scale: 2,
  trial: 3,
  unknown: -1,
} as const;

export type TCloudStripePlan = keyof typeof CLOUD_PLAN_LEVEL;

export const getCloudPlanFromProductId = (productId: string | null | undefined): TCloudStripePlan => {
  if (!productId) return "unknown";
  if (productId === CLOUD_STRIPE_PRODUCT_IDS.HOBBY) return "hobby";
  if (productId === CLOUD_STRIPE_PRODUCT_IDS.PRO) return "pro";
  if (productId === CLOUD_STRIPE_PRODUCT_IDS.SCALE) return "scale";
  if (productId === CLOUD_STRIPE_PRODUCT_IDS.TRIAL) return "trial";
  return "unknown";
};

export const getLegacyPlanFromCloudPlan = (plan: TCloudStripePlan): string => {
  if (plan === "hobby" || plan === "unknown") return "free";
  if (plan === "pro" || plan === "trial") return "startup";
  return "custom";
};

export const getLimitsFromCloudPlan = (
  plan: TCloudStripePlan
): { projects: number | null; responses: number | null; contacts: number | null } => {
  if (plan === "hobby") {
    return { projects: 1, responses: 250, contacts: null };
  }

  if (plan === "pro" || plan === "trial") {
    return { projects: 3, responses: 2000, contacts: 5000 };
  }

  if (plan === "scale") {
    return { projects: 5, responses: 5000, contacts: 10000 };
  }

  return { projects: 1, responses: 250, contacts: null };
};
