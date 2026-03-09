import "server-only";
import { logger } from "@formbricks/logger";

const DEFAULT_CLOUD_STRIPE_PRODUCT_IDS = {
  HOBBY: "prod_ToYKB5ESOMZZk5",
  PRO: "prod_ToYKQ8WxS3ecgf",
  SCALE: "prod_ToYLW5uCQTMa6v",
} as const;

export const CLOUD_STRIPE_PRODUCT_IDS = {
  HOBBY: process.env.STRIPE_PRODUCT_ID_HOBBY?.trim() || DEFAULT_CLOUD_STRIPE_PRODUCT_IDS.HOBBY,
  PRO: process.env.STRIPE_PRODUCT_ID_PRO?.trim() || DEFAULT_CLOUD_STRIPE_PRODUCT_IDS.PRO,
  SCALE: process.env.STRIPE_PRODUCT_ID_SCALE?.trim() || DEFAULT_CLOUD_STRIPE_PRODUCT_IDS.SCALE,
} as const;

const cloudStripeProductIdsUsingDefaults = Object.entries(DEFAULT_CLOUD_STRIPE_PRODUCT_IDS).flatMap(
  ([planKey, defaultProductId]) =>
    CLOUD_STRIPE_PRODUCT_IDS[planKey as keyof typeof CLOUD_STRIPE_PRODUCT_IDS] === defaultProductId
      ? [planKey]
      : []
);

if (
  process.env.IS_FORMBRICKS_CLOUD === "1" &&
  cloudStripeProductIdsUsingDefaults.length > 0 &&
  process.env.NODE_ENV !== "test"
) {
  const message = `Cloud Stripe product IDs are using defaults for: ${cloudStripeProductIdsUsingDefaults.join(", ")}. Configure STRIPE_PRODUCT_ID_* environment variables.`;
  logger.warn({ cloudStripeProductIdsUsingDefaults }, message);
}

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
  HIDE_BRANDING: "hide-branding",
  QUOTA_MANAGEMENT: "quota-management",
  RBAC: "rbac",
  SPAM_PROTECTION: "spam-protection",
  MULTI_LANGUAGE_SURVEYS: "multi-language-surveys",
  CONTACTS: "contacts",
} as const;

export const CLOUD_PLAN_LEVEL = {
  hobby: 0,
  pro: 1,
  scale: 2,
  unknown: -1,
} as const;

export type TCloudStripePlan = keyof typeof CLOUD_PLAN_LEVEL;

export const getCloudPlanFromProductId = (productId: string | null | undefined): TCloudStripePlan => {
  if (!productId) return "unknown";
  if (productId === CLOUD_STRIPE_PRODUCT_IDS.HOBBY) return "hobby";
  if (productId === CLOUD_STRIPE_PRODUCT_IDS.PRO) return "pro";
  if (productId === CLOUD_STRIPE_PRODUCT_IDS.SCALE) return "scale";
  return "unknown";
};
