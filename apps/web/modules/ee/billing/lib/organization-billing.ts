import "server-only";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import {
  type TOrganizationBilling,
  type TOrganizationStripeSubscriptionStatus,
} from "@formbricks/types/organizations";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { stripeClient } from "./stripe-client";
import { CLOUD_PLAN_LEVEL, type TCloudStripePlan, getCloudPlanFromProduct } from "./stripe-plan";

const BILLING_SYNC_STALE_MS = 5 * 60 * 1000;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(["trialing", "active", "past_due", "unpaid", "paused"]);

const ORGANIZATION_BILLING_SELECT = {
  stripeCustomerId: true,
  limits: true,
  usageCycleAnchor: true,
  stripe: true,
} satisfies Prisma.OrganizationBillingSelect;

type TOrganizationBillingRecord = Prisma.OrganizationBillingGetPayload<{
  select: typeof ORGANIZATION_BILLING_SELECT;
}>;

const getBillingCacheKey = (organizationId: string) => createCacheKey.organization.billing(organizationId);

export const invalidateOrganizationBillingCache = async (organizationId: string): Promise<void> => {
  await cache.del([getBillingCacheKey(organizationId)]);
};

export const getDefaultOrganizationBilling = (): TOrganizationBilling => ({
  limits: {
    projects: IS_FORMBRICKS_CLOUD ? 1 : 3,
    monthly: {
      responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
    },
  },
  stripeCustomerId: null,
  usageCycleAnchor: null,
});

const mapBillingRecord = (billing: TOrganizationBillingRecord | null): TOrganizationBilling | null => {
  if (!billing) {
    return null;
  }

  return {
    stripeCustomerId: billing.stripeCustomerId,
    limits: billing.limits,
    usageCycleAnchor: billing.usageCycleAnchor,
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

const parseEntitlementLimit = (features: string[], prefix: string): number | null | undefined => {
  let maxValue: number | null | undefined;

  for (const feature of features) {
    if (!feature.startsWith(prefix)) continue;
    const rawValue = feature.slice(prefix.length);
    if (rawValue === "unlimited") {
      return null;
    }
    if (!/^\d+$/.test(rawValue)) continue;
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) continue;
    if (maxValue == null) {
      maxValue = parsed;
      continue;
    }
    maxValue = Math.max(maxValue, parsed);
  }

  return maxValue;
};

const hydrateSubscriptionProducts = async <
  TSubscription extends {
    items: {
      data: Array<{
        price: {
          product: string | Stripe.Product | Stripe.DeletedProduct;
        };
      }>;
    };
  },
>(
  subscriptions: TSubscription[]
): Promise<TSubscription[]> => {
  if (!stripeClient || subscriptions.length === 0) {
    return subscriptions;
  }
  const client = stripeClient;

  const productIds = [
    ...new Set(
      subscriptions.flatMap((subscription) =>
        subscription.items.data.flatMap((item) =>
          typeof item.price.product === "string" ? [item.price.product] : []
        )
      )
    ),
  ];

  if (productIds.length === 0) {
    return subscriptions;
  }

  const products = await Promise.all(
    productIds.map(async (productId) => [productId, await client.products.retrieve(productId)] as const)
  );

  const productsById = new Map(products);

  return subscriptions.map((subscription) => ({
    ...subscription,
    items: {
      ...subscription.items,
      data: subscription.items.data.map((item) => ({
        ...item,
        price: {
          ...item.price,
          product:
            typeof item.price.product === "string"
              ? (productsById.get(item.price.product) ?? item.price.product)
              : item.price.product,
        },
      })),
    },
  }));
};

const getSubscriptionTopPlanLevel = (
  subscription: {
    items: {
      data: Array<{
        price: {
          product: string | Stripe.Product | Stripe.DeletedProduct;
        };
      }>;
    };
  } | null
): number => {
  if (!subscription) return CLOUD_PLAN_LEVEL.unknown;

  let topLevel: number = CLOUD_PLAN_LEVEL.unknown;

  for (const item of subscription.items.data) {
    const plan = getCloudPlanFromProduct(item.price.product);
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
  const subscriptionsWithProducts = await hydrateSubscriptionProducts(subscriptions.data);

  const preferred = [...subscriptionsWithProducts]
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
    const plan = getCloudPlanFromProduct(item.price.product);
    if (CLOUD_PLAN_LEVEL[plan] > CLOUD_PLAN_LEVEL[resolvedPlan]) {
      resolvedPlan = plan;
    }
  }

  return resolvedPlan;
};

const resolveSubscriptionStatus = (
  subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>
): TOrganizationStripeSubscriptionStatus | null => {
  return subscription?.status ?? null;
};

const resolveUsageCycleAnchor = (
  subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>
): Date | null => {
  if (!subscription?.billing_cycle_anchor) return null;

  return new Date(subscription.billing_cycle_anchor * 1000);
};

const ensureHobbySubscription = async (
  organizationId: string,
  customerId: string,
  idempotencySuffix: string
): Promise<void> => {
  if (!stripeClient) return;

  const products = await stripeClient.products.list({
    active: true,
    limit: 100,
  });

  const hobbyProduct = products.data.find((product) => product.metadata.formbricks_plan === "hobby");
  if (!hobbyProduct) {
    throw new Error("Stripe product metadata formbricks_plan=hobby not found");
  }

  const defaultPrice =
    typeof hobbyProduct.default_price === "string" ? null : (hobbyProduct.default_price ?? null);

  const fallbackPrices = await stripeClient.prices.list({
    product: hobbyProduct.id,
    active: true,
    limit: 100,
  });

  const hobbyPrice =
    defaultPrice ??
    fallbackPrices.data.find(
      (price) => price.recurring?.interval === "month" && price.recurring.usage_type === "licensed"
    ) ??
    fallbackPrices.data[0] ??
    null;

  if (!hobbyPrice) {
    throw new Error(`No active price found for Stripe hobby product ${hobbyProduct.id}`);
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

/**
 * Checks whether the given email has already used a Pro trial on any Stripe customer.
 * Searches all customers with that email and inspects their subscription history.
 */
const hasEmailUsedProTrial = async (email: string, proProductId: string): Promise<boolean> => {
  if (!stripeClient) return false;

  const customers = await stripeClient.customers.list({
    email,
    limit: 100,
  });

  for (const customer of customers.data) {
    const subscriptions = await stripeClient.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 100,
    });

    const hadProTrial = subscriptions.data.some(
      (sub) =>
        sub.trial_start != null &&
        sub.items.data.some((item) => {
          const productId =
            typeof item.price.product === "string" ? item.price.product : item.price.product.id;
          return productId === proProductId;
        })
    );

    if (hadProTrial) return true;
  }

  return false;
};

export const createProTrialSubscription = async (
  organizationId: string,
  customerId: string
): Promise<void> => {
  if (!stripeClient) return;

  const products = await stripeClient.products.list({
    active: true,
    limit: 100,
  });

  const proProduct = products.data.find((product) => product.metadata.formbricks_plan === "pro");
  if (!proProduct) {
    throw new Error("Stripe product metadata formbricks_plan=pro not found");
  }

  const customer = await stripeClient.customers.retrieve(customerId);
  if (!customer.deleted && customer.email) {
    const alreadyUsed = await hasEmailUsedProTrial(customer.email, proProduct.id);
    if (alreadyUsed) {
      throw new OperationNotAllowedError("trial_already_used");
    }
  }

  const defaultPrice =
    typeof proProduct.default_price === "string" ? null : (proProduct.default_price ?? null);

  const fallbackPrices = await stripeClient.prices.list({
    product: proProduct.id,
    active: true,
    limit: 100,
  });

  const proPrice =
    defaultPrice ??
    fallbackPrices.data.find(
      (price) => price.recurring?.interval === "month" && price.recurring.usage_type === "licensed"
    ) ??
    fallbackPrices.data[0] ??
    null;

  if (!proPrice) {
    throw new Error(`No active price found for Stripe pro product ${proProduct.id}`);
  }

  await stripeClient.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: proPrice.id, quantity: 1 }],
      trial_period_days: 14,
      trial_settings: {
        end_behavior: {
          missing_payment_method: "cancel",
        },
      },
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: { organizationId },
    },
    { idempotencyKey: `create-pro-trial-${organizationId}` }
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
  const billing = await prisma.organizationBilling.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      stripeCustomerId: defaultBilling.stripeCustomerId,
      limits: defaultBilling.limits,
      usageCycleAnchor: defaultBilling.usageCycleAnchor,
    },
    select: ORGANIZATION_BILLING_SELECT,
  });

  return mapBillingRecord(billing);
};

/**
 * Finds the email of the organization owner by looking up the membership with role "owner"
 * and joining to the user table.
 */
const getOrganizationOwner = async (
  organizationId: string
): Promise<{ email: string; name: string | null } | null> => {
  const membership = await prisma.membership.findFirst({
    where: { organizationId, role: "owner" },
    select: { user: { select: { email: true, name: true } } },
  });
  if (!membership) return null;
  return { email: membership.user.email, name: membership.user.name };
};

/**
 * Searches Stripe for an existing non-deleted customer with the given email.
 * Returns the first match, or null if none found.
 */
const findStripeCustomerByEmail = async (email: string): Promise<Stripe.Customer | null> => {
  if (!stripeClient) return null;

  const customers = await stripeClient.customers.list({
    email,
    limit: 1,
  });

  const customer = customers.data[0];
  if (customer && !customer.deleted) {
    return customer;
  }
  return null;
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

  // Look up the org owner's email/name and check if a Stripe customer already exists for it.
  // This reuses the old customer (and its trial history) when a user deletes their account
  // and signs up again with the same email.
  const owner = await getOrganizationOwner(organization.id);
  if (!owner) {
    logger.error({ organizationId }, "Cannot set up Stripe customer: organization has no owner");
    return { customerId: null };
  }

  const { email: ownerEmail, name: ownerName } = owner;
  let existingCustomer: Stripe.Customer | null = null;

  if (ownerEmail) {
    const foundCustomer = await findStripeCustomerByEmail(ownerEmail);
    if (foundCustomer) {
      // Only reuse if this customer is not already linked to another org's billing record
      const existingBillingOwner = await findOrganizationIdByStripeCustomerId(foundCustomer.id);
      if (!existingBillingOwner || existingBillingOwner === organizationId) {
        existingCustomer = foundCustomer;
        await stripeClient.customers.update(existingCustomer.id, {
          name: ownerName ?? undefined,
          metadata: { organizationId: organization.id, organizationName: organization.name },
        });
        logger.info(
          { organizationId, customerId: existingCustomer.id, email: ownerEmail },
          "Reusing existing Stripe customer for new organization"
        );
      }
    }
  }

  const customer =
    existingCustomer ??
    (await stripeClient.customers.create(
      {
        name: ownerName ?? undefined,
        email: ownerEmail,
        metadata: { organizationId: organization.id, organizationName: organization.name },
      },
      { idempotencyKey: `ensure-customer-${organization.id}` }
    ));

  const defaultBilling = getDefaultOrganizationBilling();

  // Always create/update the billing record with the resolved Stripe customer ID.
  // Using upsert so the billing row is created if it doesn't exist yet.
  await prisma.organizationBilling.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      stripeCustomerId: customer.id,
      limits: defaultBilling.limits,
      usageCycleAnchor: defaultBilling.usageCycleAnchor,
      stripe: { lastSyncedAt: new Date().toISOString() },
    },
    update: {
      stripeCustomerId: customer.id,
      stripe: { lastSyncedAt: new Date().toISOString() },
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
  const subscriptionStatus = resolveSubscriptionStatus(subscription);
  const usageCycleAnchor = resolveUsageCycleAnchor(subscription);
  const previousLimits = billing.limits;
  const workspaceLimitFromEntitlements = parseEntitlementLimit(featureLookupKeys, "workspace-limit-");
  const responsesIncludedFromEntitlements = parseEntitlementLimit(featureLookupKeys, "responses-included-");

  const projectsLimit =
    workspaceLimitFromEntitlements === undefined
      ? (previousLimits?.projects ?? null)
      : workspaceLimitFromEntitlements;

  if (workspaceLimitFromEntitlements === undefined && previousLimits?.projects == null) {
    logger.warn(
      { organizationId, customerId, cloudPlan, featureLookupKeys },
      "No workspace limit entitlement found in Stripe entitlements; preserving previous projects limit"
    );
  }

  const responsesIncludedLimit =
    responsesIncludedFromEntitlements === undefined
      ? (previousLimits?.monthly?.responses ?? null)
      : responsesIncludedFromEntitlements;

  if (responsesIncludedFromEntitlements === undefined && previousLimits?.monthly?.responses == null) {
    logger.warn(
      { organizationId, customerId, cloudPlan, featureLookupKeys },
      "No responses included entitlement found in Stripe entitlements; preserving previous responses limit"
    );
  }

  const updatedBilling: TOrganizationBilling = {
    stripeCustomerId: customerId,
    limits: {
      projects: projectsLimit,
      monthly: {
        responses: responsesIncludedLimit,
      },
    },
    usageCycleAnchor,
    stripe: {
      ...billing.stripe,
      plan: cloudPlan,
      subscriptionStatus,
      subscriptionId: subscription?.id ?? null,
      hasPaymentMethod: subscription?.default_payment_method != null,
      features: featureLookupKeys,
      lastStripeEventCreatedAt: toIsoStringOrNull(incomingEventDate ?? previousEventDate),
      lastSyncedAt: new Date().toISOString(),
      lastSyncedEventId: event?.id ?? existingStripeSnapshot?.lastSyncedEventId ?? null,
      trialEnd: subscription?.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : (existingStripeSnapshot?.trialEnd ?? null),
    },
  };

  await prisma.organizationBilling.update({
    where: { organizationId },
    data: {
      stripeCustomerId: updatedBilling.stripeCustomerId,
      limits: updatedBilling.limits,
      usageCycleAnchor: updatedBilling.usageCycleAnchor,
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

/**
 * Cleans up a Stripe customer after organization deletion by cancelling all active
 * subscriptions. The customer object is intentionally kept so that trial usage history
 * is preserved — this prevents the same email from claiming a free trial again.
 */
export const cleanupStripeCustomer = async (stripeCustomerId: string): Promise<void> => {
  if (!stripeClient) return;

  const subscriptions = await stripeClient.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100,
  });

  await Promise.all(
    subscriptions.data
      .filter((sub) => ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status))
      .map((sub) => stripeClient!.subscriptions.cancel(sub.id, { prorate: false }))
  );
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
  const subscriptionsWithProducts = await hydrateSubscriptionProducts(subscriptions.data);

  const activeSubscriptions = subscriptionsWithProducts.filter((subscription) =>
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
    // Re-check active subscriptions to guard against concurrent reconciliation calls
    // (e.g. webhook + bootstrap) both seeing 0 and creating duplicate hobbies.
    const freshSubscriptions = await client.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (freshSubscriptions.data.length === 0) {
      await ensureHobbySubscription(organizationId, customerId, idempotencySuffix);
    }
  }
};

export const ensureCloudStripeSetupForOrganization = async (organizationId: string): Promise<void> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) return;
  await ensureStripeCustomerForOrganization(organizationId);
  await syncOrganizationBillingFromStripe(organizationId);
};
