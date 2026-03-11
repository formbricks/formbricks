import "server-only";
import Stripe from "stripe";

export const CLOUD_PLAN_LEVEL = {
  hobby: 0,
  pro: 1,
  scale: 2,
  custom: 3,
  unknown: -1,
} as const;

export type TCloudStripePlan = keyof typeof CLOUD_PLAN_LEVEL;

const CLOUD_PRODUCT_METADATA_TO_PLAN = {
  hobby: "hobby",
  pro: "pro",
  scale: "scale",
  custom: "custom",
} as const satisfies Record<string, Exclude<TCloudStripePlan, "unknown">>;

const getProductPlanMetadata = (
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined
): string | null => {
  if (!product || typeof product === "string" || product.deleted) {
    return null;
  }

  return product.metadata.formbricks_plan ?? null;
};

export const getCloudPlanFromProduct = (
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined
): TCloudStripePlan => {
  const metadataPlan = getProductPlanMetadata(product);
  if (!metadataPlan) return "unknown";
  return (
    CLOUD_PRODUCT_METADATA_TO_PLAN[metadataPlan as keyof typeof CLOUD_PRODUCT_METADATA_TO_PLAN] ?? "unknown"
  );
};
