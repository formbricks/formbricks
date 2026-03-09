import "server-only";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { type TOrganizationBilling } from "@formbricks/types/organizations";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import {
  CLOUD_PLAN_LEVEL,
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS,
  type TCloudStripePlan,
  getCloudPlanFromProductId,
} from "./stripe-catalog";
import { stripeClient } from "./stripe-client";

const BILLING_SYNC_STALE_MS = 5 * 60 * 1000;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(["trialing", "active", "past_due", "unpaid", "paused"]);

type TResponseMeteringProjection = {
  usagePriceId: string | null;
  includedResponses: number | null;
  overageUnitAmountCents: number | null;
  currency: string | null;
};

const ORGANIZATION_BILLING_SELECT = {
  stripeCustomerId: true,
  limits: true,
  periodStart: true,
  stripe: true,
} satisfies Prisma.OrganizationBillingSelect;

type TOrganizationBillingRecord = Prisma.OrganizationBillingGetPayload<{
  select: typeof ORGANIZATION_BILLING_SELECT;
}>;

const getBillingCacheKey = (organizationId: string) => createCacheKey.organization.billing(organizationId);

export const invalidateOrganizationBillingCache = async (organizationId: string): Promise<void> => {
  await cache.del([getBillingCacheKey(organizationId)]);
};

const getDefaultOrganizationBilling = (): TOrganizationBilling => ({
  limits: {
    projects: IS_FORMBRICKS_CLOUD ? 1 : 3,
    monthly: {
      responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
      miu: 2000,
    },
  },
  stripeCustomerId: null,
  periodStart: new Date(),
});

const mapBillingRecord = (billing: TOrganizationBillingRecord | null): TOrganizationBilling | null => {
  if (!billing) {
    return null;
  }

  return {
    stripeCustomerId: billing.stripeCustomerId,
    limits: billing.limits,
    periodStart: billing.periodStart,
    ...(billing.stripe == null ? {} : { stripe: billing.stripe }),
  };
};

const toIsoStringOrNull = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;

const getDateFromBilling = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

  let resolvedPlan: TCloudStripePlan = "unknown";

  for (const item of subscription.items.data) {
    const product = item.price.product;
    const productId = typeof product === "string" ? product : product.id;
    const plan = getCloudPlanFromProductId(productId);
    if (CLOUD_PLAN_LEVEL[plan] > CLOUD_PLAN_LEVEL[resolvedPlan]) {
      resolvedPlan = plan;
    }
  }

  return resolvedPlan;
};

const resolvePeriodStart = (subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>) => {
  if (!subscription) return new Date();

  const legacyCurrentPeriodStart = (subscription as Stripe.Subscription & { current_period_start?: number })
    .current_period_start;
  const periodStartTimestamp =
    legacyCurrentPeriodStart ??
    subscription.items.data[0]?.current_period_start ??
    subscription.billing_cycle_anchor;

  return periodStartTimestamp ? new Date(periodStartTimestamp * 1000) : new Date();
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

const ensureOrganizationBillingRecord = async (
  organizationId: string
): Promise<TOrganizationBilling | null> => {
  const existingBilling = await prisma.organizationBilling.findUnique({
    where: { organizationId },
    select: ORGANIZATION_BILLING_SELECT,
  });

  if (existingBilling) {
    return mapBillingRecord(existingBilling);
  }

  const organizationExists = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!organizationExists) {
    return null;
  }

  const defaultBilling = getDefaultOrganizationBilling();
  const createdBilling = await prisma.organizationBilling.create({
    data: {
      organizationId,
      stripeCustomerId: defaultBilling.stripeCustomerId,
      limits: defaultBilling.limits,
      periodStart: defaultBilling.periodStart,
    },
    select: ORGANIZATION_BILLING_SELECT,
  });

  return mapBillingRecord(createdBilling);
};

export const ensureStripeCustomerForOrganization = async (
  organizationId: string
): Promise<{ customerId: string | null }> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) {
    return { customerId: null };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    return { customerId: null };
  }

  const billing = await ensureOrganizationBillingRecord(organization.id);
  if (!billing) {
    return { customerId: null };
  }

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

  const updatedStripeSnapshot = {
    ...billing.stripe,
    lastSyncedAt: new Date().toISOString(),
  };

  await prisma.organizationBilling.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      stripeCustomerId: customer.id,
      limits: billing.limits,
      periodStart: billing.periodStart,
      stripe: updatedStripeSnapshot,
    },
    update: {
      stripeCustomerId: customer.id,
      stripe: updatedStripeSnapshot,
    },
  });

  await invalidateOrganizationBillingCache(organization.id);
  return { customerId: customer.id };
};

export const syncOrganizationBillingFromStripe = async (
  organizationId: string,
  event?: { id: string; created: number }
): Promise<TOrganizationBilling | null> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) {
    return null;
  }

  const billing = await ensureOrganizationBillingRecord(organizationId);
  if (!billing) {
    return null;
  }

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

  const updatedBilling: TOrganizationBilling = {
    stripeCustomerId: customerId,
    limits: {
      projects: projectsLimit,
      monthly: {
        responses: responsesIncludedLimit,
        // MIU/contact metering is out of scope for the current cloud billing rollout.
        miu: null,
      },
    },
    periodStart,
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

  await prisma.organizationBilling.update({
    where: { organizationId },
    data: {
      stripeCustomerId: updatedBilling.stripeCustomerId,
      limits: updatedBilling.limits,
      periodStart: updatedBilling.periodStart,
      stripe: updatedBilling.stripe,
    },
  });

  await invalidateOrganizationBillingCache(organizationId);
  return updatedBilling;
};

const isSnapshotStale = (billing: TOrganizationBilling | null): boolean => {
  const lastSyncedAt = getDateFromBilling(billing?.stripe?.lastSyncedAt ?? null);
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > BILLING_SYNC_STALE_MS;
};

const getOrganizationBillingFromDatabase = async (
  organizationId: string
): Promise<TOrganizationBilling | null> => {
  return await ensureOrganizationBillingRecord(organizationId);
};

export const getOrganizationBillingWithReadThroughSync = async (
  organizationId: string
): Promise<TOrganizationBilling | null> => {
  if (!IS_FORMBRICKS_CLOUD) {
    // Self-hosted does not need Stripe read-through sync or Redis-backed billing cache.
    return await getOrganizationBillingFromDatabase(organizationId);
  }

  const cachedBilling = await cache.withCache(
    async () => await getOrganizationBillingFromDatabase(organizationId),
    getBillingCacheKey(organizationId),
    BILLING_SYNC_STALE_MS
  );

  if (!cachedBilling?.stripeCustomerId) {
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

export const deleteStripeCustomer = async (stripeCustomerId: string): Promise<void> => {
  if (!stripeClient) return;
  await stripeClient.customers.del(stripeCustomerId);
};

export const findOrganizationIdByStripeCustomerId = async (customerId: string): Promise<string | null> => {
  const billing = await prisma.organizationBilling.findUnique({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      organizationId: true,
    },
  });

  return billing?.organizationId ?? null;
};

export const reconcileCloudStripeSubscriptionsForOrganization = async (
  organizationId: string,
  idempotencySuffix = "reconcile"
): Promise<void> => {
  const client = stripeClient;
  if (!IS_FORMBRICKS_CLOUD || !client) return;

  const billing = await getOrganizationBillingFromDatabase(organizationId);
  const customerId = billing?.stripeCustomerId;
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

  const unknownPlanSubscriptions = subscriptionsWithPlanLevel.filter(
    ({ planLevel }) => planLevel === CLOUD_PLAN_LEVEL.unknown
  );
  if (unknownPlanSubscriptions.length > 0) {
    logger.warn(
      {
        organizationId,
        subscriptionIds: unknownPlanSubscriptions.map(({ subscription }) => subscription.id),
      },
      "Found subscriptions with unknown plan level during reconciliation"
    );
  }

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
    await ensureHobbySubscription(organizationId, customerId, idempotencySuffix);
  }
};

export const ensureCloudStripeSetupForOrganization = async (organizationId: string): Promise<void> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) return;
  await ensureStripeCustomerForOrganization(organizationId);
  await reconcileCloudStripeSubscriptionsForOrganization(organizationId, "bootstrap");
  await syncOrganizationBillingFromStripe(organizationId);
};
