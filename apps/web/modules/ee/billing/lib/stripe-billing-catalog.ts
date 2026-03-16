import "server-only";
import { cache as reactCache } from "react";
import Stripe from "stripe";
import { createCacheKey } from "@formbricks/cache";
import type { TCloudBillingInterval } from "@formbricks/types/organizations";
import { cache } from "@/lib/cache";
import { env } from "@/lib/env";
import { hashString } from "@/lib/hash-string";
import { stripeClient } from "./stripe-client";

export type TStandardCloudPlan = "hobby" | "pro" | "scale";
type TStripePriceKind = "base" | "responses";

type TStripeCatalogPrice = Stripe.Price & {
  product: Stripe.Product | Stripe.DeletedProduct;
};

export type TStripeBillingCatalogItem = {
  plan: TStandardCloudPlan;
  interval: TCloudBillingInterval;
  basePrice: TStripeCatalogPrice;
  responsePrice: TStripeCatalogPrice | null;
};

export type TStripeBillingCatalog = {
  hobby: {
    monthly: TStripeBillingCatalogItem;
  };
  pro: {
    monthly: TStripeBillingCatalogItem;
    yearly: TStripeBillingCatalogItem;
  };
  scale: {
    monthly: TStripeBillingCatalogItem;
    yearly: TStripeBillingCatalogItem;
  };
};

export type TStripeBillingCatalogDisplayItem = {
  plan: TStandardCloudPlan;
  interval: TCloudBillingInterval;
  currency: string;
  unitAmount: number | null;
};

export type TStripeBillingCatalogDisplay = {
  hobby: {
    monthly: TStripeBillingCatalogDisplayItem;
  };
  pro: {
    monthly: TStripeBillingCatalogDisplayItem;
    yearly: TStripeBillingCatalogDisplayItem;
  };
  scale: {
    monthly: TStripeBillingCatalogDisplayItem;
    yearly: TStripeBillingCatalogDisplayItem;
  };
};

const STANDARD_CLOUD_PLANS = new Set<TStandardCloudPlan>(["hobby", "pro", "scale"]);
const STRIPE_BILLING_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const STRIPE_BILLING_CATALOG_CACHE_VERSION = "v1";

const getStripeBillingCatalogCacheKey = () =>
  createCacheKey.custom(
    "billing",
    "stripe_catalog",
    `${hashString(env.STRIPE_SECRET_KEY ?? "stripe-unconfigured")}-${STRIPE_BILLING_CATALOG_CACHE_VERSION}`
  );

const getPriceProduct = (price: Stripe.Price): Stripe.Product | Stripe.DeletedProduct | null => {
  if (typeof price.product === "string") {
    return null;
  }

  return price.product;
};

const getPricePlan = (price: Stripe.Price): TStandardCloudPlan | null => {
  const product = getPriceProduct(price);
  const plan =
    price.metadata?.formbricks_plan ??
    (!product || product.deleted ? undefined : product.metadata?.formbricks_plan);

  if (!plan || !STANDARD_CLOUD_PLANS.has(plan as TStandardCloudPlan)) {
    return null;
  }

  return plan as TStandardCloudPlan;
};

const normalizeInterval = (interval: string | null | undefined): TCloudBillingInterval | null => {
  if (interval === "month" || interval === "monthly") return "monthly";
  if (interval === "year" || interval === "yearly") return "yearly";
  return null;
};

const getPriceInterval = (price: Stripe.Price): TCloudBillingInterval | null => {
  const metadataInterval = normalizeInterval(price.metadata?.formbricks_interval);
  if (metadataInterval) {
    return metadataInterval;
  }

  return normalizeInterval(price.recurring?.interval);
};

const getPriceKind = (price: Stripe.Price): TStripePriceKind | null => {
  const metadataKind = price.metadata?.formbricks_price_kind;
  if (metadataKind === "base" || metadataKind === "responses") {
    return metadataKind;
  }

  if (price.recurring?.usage_type === "licensed") {
    return "base";
  }

  if (price.recurring?.usage_type === "metered") {
    return "responses";
  }

  return null;
};

const isCatalogCandidate = (price: Stripe.Price): price is TStripeCatalogPrice => {
  if (!price.active || !price.recurring) {
    return false;
  }

  const product = getPriceProduct(price);
  if (!product || product.deleted || !product.active) {
    return false;
  }

  return getPricePlan(price) !== null && getPriceKind(price) !== null && getPriceInterval(price) !== null;
};

const listAllActivePrices = async (): Promise<TStripeCatalogPrice[]> => {
  if (!stripeClient) {
    return [];
  }

  const prices: TStripeCatalogPrice[] = [];
  let startingAfter: string | undefined;

  do {
    const result = await stripeClient.prices.list({
      active: true,
      limit: 100,
      expand: ["data.product"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const price of result.data) {
      if (isCatalogCandidate(price)) {
        prices.push(price);
      }
    }

    const lastItem = result.data.at(-1);
    startingAfter = result.has_more && lastItem ? lastItem.id : undefined;
  } while (startingAfter);

  return prices;
};

const getSinglePrice = (
  prices: TStripeCatalogPrice[],
  plan: TStandardCloudPlan,
  kind: TStripePriceKind,
  interval: TCloudBillingInterval
): TStripeCatalogPrice => {
  const matches = prices.filter(
    (price) =>
      getPricePlan(price) === plan && getPriceKind(price) === kind && getPriceInterval(price) === interval
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Stripe price for ${plan}/${kind}/${interval}, but found ${matches.length}`
    );
  }

  return matches[0];
};

const fetchStripeBillingCatalog = async (): Promise<TStripeBillingCatalog> => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured");
  }

  const prices = await listAllActivePrices();

  if (prices.length === 0) {
    throw new Error("No active Stripe billing catalog prices found");
  }

  return {
    hobby: {
      monthly: {
        plan: "hobby",
        interval: "monthly",
        basePrice: getSinglePrice(prices, "hobby", "base", "monthly"),
        responsePrice: null,
      },
    },
    pro: {
      monthly: {
        plan: "pro",
        interval: "monthly",
        basePrice: getSinglePrice(prices, "pro", "base", "monthly"),
        responsePrice: getSinglePrice(prices, "pro", "responses", "monthly"),
      },
      yearly: {
        plan: "pro",
        interval: "yearly",
        basePrice: getSinglePrice(prices, "pro", "base", "yearly"),
        responsePrice: getSinglePrice(prices, "pro", "responses", "monthly"),
      },
    },
    scale: {
      monthly: {
        plan: "scale",
        interval: "monthly",
        basePrice: getSinglePrice(prices, "scale", "base", "monthly"),
        responsePrice: getSinglePrice(prices, "scale", "responses", "monthly"),
      },
      yearly: {
        plan: "scale",
        interval: "yearly",
        basePrice: getSinglePrice(prices, "scale", "base", "yearly"),
        responsePrice: getSinglePrice(prices, "scale", "responses", "monthly"),
      },
    },
  };
};

export const getStripeBillingCatalog = reactCache(async (): Promise<TStripeBillingCatalog> => {
  return await cache.withCache(
    fetchStripeBillingCatalog,
    getStripeBillingCatalogCacheKey(),
    STRIPE_BILLING_CATALOG_CACHE_TTL_MS
  );
});

export const getStripeBillingCatalogDisplay = reactCache(async (): Promise<TStripeBillingCatalogDisplay> => {
  const catalog = await getStripeBillingCatalog();

  return {
    hobby: {
      monthly: {
        plan: "hobby",
        interval: "monthly",
        currency: catalog.hobby.monthly.basePrice.currency,
        unitAmount: catalog.hobby.monthly.basePrice.unit_amount,
      },
    },
    pro: {
      monthly: {
        plan: "pro",
        interval: "monthly",
        currency: catalog.pro.monthly.basePrice.currency,
        unitAmount: catalog.pro.monthly.basePrice.unit_amount,
      },
      yearly: {
        plan: "pro",
        interval: "yearly",
        currency: catalog.pro.yearly.basePrice.currency,
        unitAmount: catalog.pro.yearly.basePrice.unit_amount,
      },
    },
    scale: {
      monthly: {
        plan: "scale",
        interval: "monthly",
        currency: catalog.scale.monthly.basePrice.currency,
        unitAmount: catalog.scale.monthly.basePrice.unit_amount,
      },
      yearly: {
        plan: "scale",
        interval: "yearly",
        currency: catalog.scale.yearly.basePrice.currency,
        unitAmount: catalog.scale.yearly.basePrice.unit_amount,
      },
    },
  };
});

export const getCatalogItemForPlan = async (
  plan: TStandardCloudPlan,
  interval: TCloudBillingInterval
): Promise<TStripeBillingCatalogItem> => {
  const catalog = await getStripeBillingCatalog();

  if (plan === "hobby") {
    return catalog.hobby.monthly;
  }

  return catalog[plan][interval];
};

export const getCatalogItemsForPlan = async (
  plan: TStandardCloudPlan,
  interval: TCloudBillingInterval
): Promise<Array<{ price: string; quantity?: number }>> => {
  const item = await getCatalogItemForPlan(plan, interval);

  return [
    { price: item.basePrice.id, quantity: 1 },
    ...(item.responsePrice ? [{ price: item.responsePrice.id }] : []),
  ];
};

export const getIntervalFromPrice = (
  price: Stripe.Price | null | undefined
): TCloudBillingInterval | null => {
  if (!price) {
    return null;
  }

  return getPriceInterval(price);
};

export const getPlanFromPrice = (price: Stripe.Price | null | undefined): TStandardCloudPlan | null => {
  if (!price) {
    return null;
  }

  return getPricePlan(price);
};

export const getPriceKindFromPrice = (price: Stripe.Price | null | undefined): TStripePriceKind | null => {
  if (!price) {
    return null;
  }

  return getPriceKind(price);
};
