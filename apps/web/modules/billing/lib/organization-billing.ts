import "server-only";
import Stripe from "stripe";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TOrganizationBilling } from "@formbricks/types/organizations";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import {
  CLOUD_PLAN_LEVEL,
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS,
  type TCloudStripePlan,
  getCloudPlanFromProductId,
  getLegacyPlanFromCloudPlan,
} from "./stripe-catalog";
import { stripeClient } from "./stripe-client";

const BILLING_SYNC_STALE_MS = 5 * 60 * 1000;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(["trialing", "active", "past_due", "unpaid", "paused"]);

type TBillingJson = Omit<TOrganizationBilling, "periodStart"> & {
  periodStart?: string | Date | null;
};

type TResponseMeteringProjection = {
  usagePriceId: string | null;
  includedResponses: number | null;
  overageUnitAmountCents: number | null;
  currency: string | null;
};

const getBillingCacheKey = (organizationId: string) =>
  createCacheKey.organization.billing(organizationId);

export const invalidateOrganizationBillingCache = async (organizationId: string): Promise<void> => {
  await cache.del([getBillingCacheKey(organizationId)]);
};

const toIsoStringOrNull = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;

const getDateFromBilling = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getBillingOrThrow = (organizationId: string, billing: unknown): TBillingJson => {
  if (!billing) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }
  return billing as TBillingJson;
};

const listAllActiveEntitlements = async (customerId: string): Promise<string[]> => {
  if (!stripeClient) return [];

  const featureLookupKeys: string[] = [];
  let startingAfter: string | undefined;

  do {
    const result = await stripeClient.entitlements.activeEntitlements.list({
      customer: customerId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const entitlement of result.data) {
      if (entitlement.lookup_key) {
        featureLookupKeys.push(entitlement.lookup_key);
      }
    }

    const lastItem = result.data.at(-1);
    startingAfter = result.has_more && lastItem ? lastItem.id : undefined;
  } while (startingAfter);

  return [...new Set(featureLookupKeys)];
};

const parseMaxNumericEntitlementLimit = (features: string[], prefix: string): number | null => {
  let maxValue: number | null = null;

  for (const feature of features) {
    if (!feature.startsWith(prefix)) continue;
    const rawValue = feature.slice(prefix.length);
    if (!/^\d+$/.test(rawValue)) continue;
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) continue;
    maxValue = maxValue === null ? parsed : Math.max(maxValue, parsed);
  }

  return maxValue;
};

const getResponseUsagePriceLookupKeyForPlan = (plan: TCloudStripePlan): string | null => {
  if (plan === "pro") return CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_USAGE_RESPONSES;
  if (plan === "scale") return CLOUD_STRIPE_PRICE_LOOKUP_KEYS.SCALE_USAGE_RESPONSES;
  return null;
};

const isResponseUsagePrice = (price: Stripe.Price, plan: TCloudStripePlan): boolean => {
  const expectedLookupKey = getResponseUsagePriceLookupKeyForPlan(plan);
  if (!expectedLookupKey) return false;
  return price.lookup_key === expectedLookupKey;
};

const parseGraduatedResponseMeteringFromPrice = (price: Stripe.Price): TResponseMeteringProjection | null => {
  if (price.recurring?.usage_type !== "metered") return null;
  if (price.billing_scheme !== "tiered" || price.tiers_mode !== "graduated" || !price.tiers?.length) {
    return null;
  }

  const sortedTiers = [...price.tiers].sort((a, b) => {
    const aUpTo = a.up_to ?? Number.POSITIVE_INFINITY;
    const bUpTo = b.up_to ?? Number.POSITIVE_INFINITY;
    return aUpTo - bUpTo;
  });

  let includedResponses: number | null = null;
  let overageUnitAmountCents: number | null = null;

  for (const tier of sortedTiers) {
    const unitAmount = tier.unit_amount;
    const upTo = tier.up_to;

    if (unitAmount === 0 && typeof upTo === "number") {
      includedResponses = Math.max(includedResponses ?? 0, upTo);
      continue;
    }

    if (typeof unitAmount === "number" && unitAmount > 0) {
      overageUnitAmountCents = unitAmount;
      break;
    }
  }

  return {
    usagePriceId: price.id,
    includedResponses,
    overageUnitAmountCents,
    currency: price.currency ?? null,
  };
};

const resolveResponseMeteringProjection = (
  subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>,
  cloudPlan: TCloudStripePlan
): TResponseMeteringProjection | null => {
  if (!subscription) return null;

  const meteredItem = subscription.items.data.find((item) => isResponseUsagePrice(item.price, cloudPlan));

  if (!meteredItem) return null;

  return parseGraduatedResponseMeteringFromPrice(meteredItem.price);
};

const getSubscriptionTopPlanLevel = (
  subscription: {
    items: {
      data: Array<{
        price: {
          product: string | { id: string };
        };
      }>;
    };
  } | null
): number => {
  if (!subscription) return CLOUD_PLAN_LEVEL.unknown;

  let topLevel: number = CLOUD_PLAN_LEVEL.unknown;

  for (const item of subscription.items.data) {
    const product = item.price.product;
    const productId = typeof product === "string" ? product : product.id;
    const plan = getCloudPlanFromProductId(productId);
    topLevel = Math.max(topLevel, CLOUD_PLAN_LEVEL[plan]);
  }

  return topLevel;
};

const resolveCurrentSubscription = async (customerId: string) => {
  if (!stripeClient) return null;

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const preferred = [...subscriptions.data]
    .filter((subscription) => ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status))
    .sort((left, right) => {
      const leftLevel = getSubscriptionTopPlanLevel(left);
      const rightLevel = getSubscriptionTopPlanLevel(right);

      if (leftLevel !== rightLevel) {
        return rightLevel - leftLevel;
      }

      return right.created - left.created;
    })[0];

  return preferred ?? null;
};

const resolveCloudPlanFromSubscription = (
  subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>
) => {
  if (!subscription) return "hobby" as TCloudStripePlan;

  for (const item of subscription.items.data) {
    const product = item.price.product;
    const productId = typeof product === "string" ? product : product.id;
    const plan = getCloudPlanFromProductId(productId);
    if (plan !== "unknown") return plan;
  }

  return "unknown" as TCloudStripePlan;
};

const resolveBillingPeriod = (subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>) => {
  if (!subscription) return "monthly" as const;
  const baseItem = subscription.items.data.find((item) => item.price.recurring?.usage_type !== "metered");
  return baseItem?.price.recurring?.interval === "year" ? ("yearly" as const) : ("monthly" as const);
};

const resolvePeriodStart = (subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>) => {
  if (!subscription?.current_period_start) return new Date();
  return new Date(subscription.current_period_start * 1000);
};

const ensureHobbySubscription = async (
  organizationId: string,
  customerId: string,
  idempotencySuffix: string
): Promise<void> => {
  if (!stripeClient) return;

  const hobbyPrices = await stripeClient.prices.list({
    lookup_keys: [CLOUD_STRIPE_PRICE_LOOKUP_KEYS.HOBBY_MONTHLY],
    active: true,
    limit: 1,
  });

  const hobbyPrice = hobbyPrices.data[0];
  if (!hobbyPrice) {
    throw new Error(`Stripe price lookup key not found: ${CLOUD_STRIPE_PRICE_LOOKUP_KEYS.HOBBY_MONTHLY}`);
  }

  await stripeClient.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: hobbyPrice.id, quantity: 1 }],
      metadata: { organizationId },
    },
    { idempotencyKey: `ensure-hobby-subscription-${organizationId}-${idempotencySuffix}` }
  );
};

export const ensureStripeCustomerForOrganization = async (
  organizationId: string
): Promise<{ customerId: string | null }> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) {
    return { customerId: null };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, billing: true },
  });

  if (!organization) {
    return { customerId: null };
  }

  const billing = getBillingOrThrow(organization.id, organization.billing);
  if (billing.stripeCustomerId) {
    return { customerId: billing.stripeCustomerId };
  }

  const customer = await stripeClient.customers.create(
    {
      name: organization.name,
      metadata: { organizationId: organization.id },
    },
    { idempotencyKey: `ensure-customer-${organization.id}` }
  );

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      billing: {
        ...billing,
        stripeCustomerId: customer.id,
        billingMode: "stripe",
        stripe: {
          ...billing.stripe,
          lastSyncedAt: new Date().toISOString(),
        },
      },
    },
  });

  await invalidateOrganizationBillingCache(organization.id);
  return { customerId: customer.id };
};

export const syncOrganizationBillingFromStripe = async (
  organizationId: string,
  event?: { id: string; created: number }
): Promise<TBillingJson | null> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, billing: true },
  });

  if (!organization) return null;

  const billing = getBillingOrThrow(organization.id, organization.billing);
  const customerId = billing.stripeCustomerId;
  if (!customerId) return billing;

  const existingStripeSnapshot = billing.stripe;
  const previousEventDate = getDateFromBilling(existingStripeSnapshot?.lastStripeEventCreatedAt ?? null);
  const incomingEventDate = event ? new Date(event.created * 1000) : null;

  if (event?.id && existingStripeSnapshot?.lastSyncedEventId === event.id) {
    return billing;
  }

  if (incomingEventDate && previousEventDate && incomingEventDate < previousEventDate) {
    return billing;
  }

  const [subscription, featureLookupKeys] = await Promise.all([
    resolveCurrentSubscription(customerId),
    listAllActiveEntitlements(customerId),
  ]);

  const cloudPlan = resolveCloudPlanFromSubscription(subscription);
  const legacyPlan = getLegacyPlanFromCloudPlan(cloudPlan);
  const period = resolveBillingPeriod(subscription);
  const periodStart = resolvePeriodStart(subscription);
  const previousLimits = billing.limits;
  const workspaceLimitFromEntitlements = parseMaxNumericEntitlementLimit(
    featureLookupKeys,
    "workspace-limit-"
  );
  const responsesIncludedFromEntitlements = parseMaxNumericEntitlementLimit(
    featureLookupKeys,
    "responses-included-"
  );
  const responseMeteringProjection = resolveResponseMeteringProjection(subscription, cloudPlan);

  const projectsLimit = workspaceLimitFromEntitlements ?? previousLimits?.projects ?? null;

  if (workspaceLimitFromEntitlements === null && previousLimits?.projects == null) {
    logger.warn(
      { organizationId, customerId, cloudPlan, featureLookupKeys },
      "No workspace limit entitlement found in Stripe entitlements; preserving previous projects limit"
    );
  }

  const responsesIncludedLimit =
    responsesIncludedFromEntitlements ??
    responseMeteringProjection?.includedResponses ??
    previousLimits?.monthly?.responses ??
    null;

  if (
    responsesIncludedFromEntitlements === null &&
    responseMeteringProjection?.includedResponses == null &&
    previousLimits?.monthly?.responses == null
  ) {
    logger.warn(
      { organizationId, customerId, cloudPlan, featureLookupKeys },
      "No responses included entitlement or metered price tier found; preserving previous responses included limit"
    );
  }

  const updatedBilling: TBillingJson = {
    ...billing,
    stripeCustomerId: customerId,
    plan: legacyPlan,
    period,
    limits: {
      projects: projectsLimit,
      monthly: {
        responses: responsesIncludedLimit,
        // MIU/contact metering is out of scope for the current cloud billing rollout.
        // Keep the legacy field for compatibility but do not sync a contact limit from Stripe.
        miu: null,
      },
    },
    periodStart: periodStart.toISOString(),
    stripe: {
      ...billing.stripe,
      plan: cloudPlan,
      subscriptionId: subscription?.id ?? null,
      features: featureLookupKeys,
      responseMetering: responseMeteringProjection ?? billing.stripe?.responseMetering,
      lastStripeEventCreatedAt: toIsoStringOrNull(incomingEventDate ?? previousEventDate),
      lastSyncedAt: new Date().toISOString(),
      lastSyncedEventId: event?.id ?? existingStripeSnapshot?.lastSyncedEventId ?? null,
    },
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      billing: updatedBilling,
    },
  });

  await invalidateOrganizationBillingCache(organizationId);
  return updatedBilling;
};

const isSnapshotStale = (billing: TBillingJson | null): boolean => {
  const lastSyncedAt = getDateFromBilling(billing?.stripe?.lastSyncedAt ?? null);
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > BILLING_SYNC_STALE_MS;
};

export const getOrganizationBillingWithReadThroughSync = async (
  organizationId: string
): Promise<TBillingJson | null> => {
  const cachedBilling = await cache.withCache(
    async () => {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { billing: true },
      });
      return (organization?.billing ?? null) as TBillingJson | null;
    },
    getBillingCacheKey(organizationId),
    BILLING_SYNC_STALE_MS
  );

  if (!IS_FORMBRICKS_CLOUD || !cachedBilling?.stripeCustomerId) {
    return cachedBilling;
  }

  if (!isSnapshotStale(cachedBilling)) {
    return cachedBilling;
  }

  try {
    const syncedBilling = await syncOrganizationBillingFromStripe(organizationId);
    return syncedBilling ?? cachedBilling;
  } catch (error) {
    logger.warn({ error, organizationId }, "Failed to refresh billing snapshot from Stripe");
    return cachedBilling;
  }
};

export const findOrganizationIdByStripeCustomerId = async (customerId: string): Promise<string | null> => {
  const organization = await prisma.organization.findFirst({
    where: {
      OR: [
        { billing: { path: ["stripeCustomerId"], equals: customerId } },
        { billing: { path: ["stripe", "customerId"], equals: customerId } },
      ],
    },
    select: { id: true },
  });

  return organization?.id ?? null;
};

export const reconcileCloudStripeSubscriptionsForOrganization = async (
  organizationId: string,
  idempotencySuffix = "reconcile"
): Promise<void> => {
  const client = stripeClient;
  if (!IS_FORMBRICKS_CLOUD || !client) return;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, billing: true },
  });

  if (!organization) return;

  const billing = getBillingOrThrow(organization.id, organization.billing);
  const customerId = billing.stripeCustomerId;
  if (!customerId) return;

  const subscriptions = await client.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const activeSubscriptions = subscriptions.data.filter((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
  );

  const subscriptionsWithPlanLevel = activeSubscriptions.map((subscription) => ({
    subscription,
    planLevel: getSubscriptionTopPlanLevel(subscription),
  }));

  const hasPaidOrTrialSubscription = subscriptionsWithPlanLevel.some(
    ({ planLevel }) => planLevel > CLOUD_PLAN_LEVEL.hobby || planLevel === CLOUD_PLAN_LEVEL.unknown
  );

  if (hasPaidOrTrialSubscription) {
    const hobbySubscriptions = subscriptionsWithPlanLevel.filter(
      ({ planLevel }) => planLevel === CLOUD_PLAN_LEVEL.hobby
    );

    await Promise.all(
      hobbySubscriptions.map(({ subscription }) =>
        client.subscriptions.cancel(subscription.id, {
          prorate: false,
        })
      )
    );
    return;
  }

  if (subscriptionsWithPlanLevel.length === 0) {
    await ensureHobbySubscription(organization.id, customerId, idempotencySuffix);
  }
};

export const ensureCloudStripeSetupForOrganization = async (organizationId: string): Promise<void> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) return;
  await ensureStripeCustomerForOrganization(organizationId);
  await reconcileCloudStripeSubscriptionsForOrganization(organizationId, "bootstrap");
  await syncOrganizationBillingFromStripe(organizationId);
};
