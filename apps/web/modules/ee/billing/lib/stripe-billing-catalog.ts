import "server-only";
import { cache as reactCache } from "react";
import Stripe from "stripe";
import { createCacheKey } from "@formbricks/cache";
import type { TCloudBillingInterval } from "@formbricks/types/organizations";
import { cache } from "@/lib/cache";
import { env } from "@/lib/env";
import { hashString } from "@/lib/hash-string";
import { type TResponsePricingTier, mapStripeTiersToResponsePricingTiers } from "./response-pricing-tiers";
import { stripeClient } from "./stripe-client";

export type TStandardCloudPlan = "hobby" | "pro" | "scale";
type TStripePriceKind = "base" | "responses" | "workflow_runs";

type TStripeCatalogPrice = Stripe.Price & {
  product: Stripe.Product | Stripe.DeletedProduct;
};

export type TStripeBillingCatalogItem = {
  plan: TStandardCloudPlan;
  interval: TCloudBillingInterval;
  basePrice: TStripeCatalogPrice;
  responsePrice: TStripeCatalogPrice | null;
  // Metered workflow-run overage. Only present on plans that include workflows (Scale today); null
  // elsewhere. Like responsePrice it is always the monthly-billed metered variant, even for a yearly
  // base, because usage is aggregated and billed monthly (ENG-1936).
  workflowRunsPrice: TStripeCatalogPrice | null;
  // The included (free) workflow-run allowance DERIVED FROM the price's own free first tier — the
  // single source of truth the usage card renders. Null when there is no workflow price. This is
  // deliberately NOT the entitlement's included-<n> value: the number the UI shows and the number
  // Stripe leaves uncharged must be the same object, or the card can reassure a customer they are
  // inside an allowance while Stripe invoices them (ENG-2193/2194).
  workflowRunsIncluded: number | null;
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

export type TResponseOverageDisplay = {
  currency: string;
  tiers: TResponsePricingTier[];
};

export type TStripeBillingCatalogDisplayItem = {
  plan: TStandardCloudPlan;
  interval: TCloudBillingInterval;
  currency: string;
  unitAmount: number | null;
  responseOverage: TResponseOverageDisplay | null;
  // Free workflow-run allowance derived from the price's free first tier (see TStripeBillingCatalogItem).
  workflowRunsIncluded: number | null;
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
// v3: catalog item carries workflowRunsPrice (metered workflow overage)
const STRIPE_BILLING_CATALOG_CACHE_VERSION = "v3";

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
  if (metadataKind === "base" || metadataKind === "responses" || metadataKind === "workflow_runs") {
    return metadataKind;
  }

  // A metered price tagged with an unrecognized kind is a separate metered product, not part of the
  // plan catalog. Exclude it here so the usage_type fallback below can't misclassify it as
  // "responses" and collide with the real responses price on the same plan/interval (ENG-1936).
  if (metadataKind) {
    return null;
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
      expand: ["data.product", "data.tiers"],
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

// Like getSinglePrice, but tolerates absence: returns null when no price matches (the kind is not
// offered on this plan), still throwing on ambiguity (>1) so a duplicate can never be silently
// ignored. Used for optional kinds like workflow_runs that exist only on some plans.
const getOptionalSinglePrice = (
  prices: TStripeCatalogPrice[],
  plan: TStandardCloudPlan,
  kind: TStripePriceKind,
  interval: TCloudBillingInterval
): TStripeCatalogPrice | null => {
  const matches = prices.filter(
    (price) =>
      getPricePlan(price) === plan && getPriceKind(price) === kind && getPriceInterval(price) === interval
  );

  if (matches.length > 1) {
    throw new Error(
      `Expected at most one Stripe price for ${plan}/${kind}/${interval}, but found ${matches.length}`
    );
  }

  return matches[0] ?? null;
};

// Resolve the included (free) workflow-run allowance from the price's OWN tier structure, and fail
// closed if the price can't honor an "included volume" claim. A graduated price whose first tier is
// free (unit_amount 0, flat_amount 0) up to a finite boundary grants exactly that many free runs —
// the number the usage card shows. Any other shape (flat per-unit, a paid first tier, or an
// unbounded free tier) means the card's "X of N included" would not match what Stripe charges, so we
// throw rather than render a reassuring-but-false allowance (ENG-2193/2194). Returns null when the
// plan has no workflow price at all.
const resolveWorkflowIncludedVolume = (price: TStripeCatalogPrice | null, label: string): number | null => {
  if (!price) {
    return null;
  }

  const firstTier = price.tiers?.[0];
  const firstTierIsFree =
    firstTier != null && (firstTier.unit_amount ?? 0) === 0 && (firstTier.flat_amount ?? 0) === 0;

  if (price.tiers_mode !== "graduated" || !firstTierIsFree || typeof firstTier?.up_to !== "number") {
    throw new Error(
      `Metered workflow price ${label} (${price.id}) must be graduated with a free first tier ` +
        `(unit_amount 0, finite up_to) so the included volume shown to customers matches what Stripe ` +
        `leaves uncharged; got tiers_mode=${price.tiers_mode ?? "null"}, ` +
        `firstTier=${JSON.stringify(firstTier ?? null)}`
    );
  }

  return firstTier.up_to;
};

const fetchStripeBillingCatalog = async (): Promise<TStripeBillingCatalog> => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured");
  }

  const prices = await listAllActivePrices();

  if (prices.length === 0) {
    throw new Error("No active Stripe billing catalog prices found");
  }

  // Resolve the workflow price AND its validated included volume together, so both the price object
  // and the number the UI trusts come from the same source and can't drift.
  const workflowRuns = (
    plan: TStandardCloudPlan
  ): Pick<TStripeBillingCatalogItem, "workflowRunsPrice" | "workflowRunsIncluded"> => {
    const workflowRunsPrice = getOptionalSinglePrice(prices, plan, "workflow_runs", "monthly");
    return {
      workflowRunsPrice,
      workflowRunsIncluded: resolveWorkflowIncludedVolume(workflowRunsPrice, `${plan}/workflow_runs/monthly`),
    };
  };

  return {
    hobby: {
      monthly: {
        plan: "hobby",
        interval: "monthly",
        basePrice: getSinglePrice(prices, "hobby", "base", "monthly"),
        responsePrice: null,
        ...workflowRuns("hobby"),
      },
    },
    pro: {
      monthly: {
        plan: "pro",
        interval: "monthly",
        basePrice: getSinglePrice(prices, "pro", "base", "monthly"),
        responsePrice: getSinglePrice(prices, "pro", "responses", "monthly"),
        ...workflowRuns("pro"),
      },
      yearly: {
        plan: "pro",
        interval: "yearly",
        basePrice: getSinglePrice(prices, "pro", "base", "yearly"),
        responsePrice: getSinglePrice(prices, "pro", "responses", "monthly"),
        ...workflowRuns("pro"),
      },
    },
    scale: {
      monthly: {
        plan: "scale",
        interval: "monthly",
        basePrice: getSinglePrice(prices, "scale", "base", "monthly"),
        responsePrice: getSinglePrice(prices, "scale", "responses", "monthly"),
        ...workflowRuns("scale"),
      },
      yearly: {
        plan: "scale",
        interval: "yearly",
        basePrice: getSinglePrice(prices, "scale", "base", "yearly"),
        responsePrice: getSinglePrice(prices, "scale", "responses", "monthly"),
        ...workflowRuns("scale"),
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

const toResponseOverageDisplay = (item: TStripeBillingCatalogItem): TResponseOverageDisplay | null => {
  // The tier table renders graduated semantics (each band priced separately),
  // so volume-mode prices must not be displayed with it.
  if (item.responsePrice?.tiers_mode !== "graduated") {
    return null;
  }

  const tiers = mapStripeTiersToResponsePricingTiers(item.responsePrice.tiers);
  if (!tiers) {
    return null;
  }

  return { currency: item.responsePrice.currency, tiers };
};

const toDisplayItem = (item: TStripeBillingCatalogItem): TStripeBillingCatalogDisplayItem => ({
  plan: item.plan,
  interval: item.interval,
  currency: item.basePrice.currency,
  unitAmount: item.basePrice.unit_amount,
  responseOverage: toResponseOverageDisplay(item),
  workflowRunsIncluded: item.workflowRunsIncluded,
});

export const getStripeBillingCatalogDisplay = reactCache(async (): Promise<TStripeBillingCatalogDisplay> => {
  const catalog = await getStripeBillingCatalog();

  return {
    hobby: {
      monthly: toDisplayItem(catalog.hobby.monthly),
    },
    pro: {
      monthly: toDisplayItem(catalog.pro.monthly),
      yearly: toDisplayItem(catalog.pro.yearly),
    },
    scale: {
      monthly: toDisplayItem(catalog.scale.monthly),
      yearly: toDisplayItem(catalog.scale.yearly),
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
    // Metered items carry no quantity (usage is reported via meter events).
    ...(item.workflowRunsPrice ? [{ price: item.workflowRunsPrice.id }] : []),
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
