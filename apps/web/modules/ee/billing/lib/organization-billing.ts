import "server-only";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  type TCloudBillingInterval,
  type TCloudBillingPlan,
  type TOrganizationBilling,
  type TOrganizationStripePendingChange,
  type TOrganizationStripeSubscriptionStatus,
} from "@formbricks/types/organizations";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@/lib/constants";
import {
  type TStandardCloudPlan,
  getCatalogItemForPlan,
  getCatalogItemsForPlan,
  getIntervalFromPrice,
  getPlanFromPrice,
  getPriceKindFromPrice,
} from "./stripe-billing-catalog";
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

const updatePendingPlanChangeSnapshot = async (
  organizationId: string,
  pendingChange: TOrganizationStripePendingChange | null
): Promise<void> => {
  const existingBilling = await ensureOrganizationBillingRecord(organizationId);
  if (!existingBilling) {
    throw new ResourceNotFoundError("OrganizationBilling", organizationId);
  }

  const nextStripeSnapshot = existingBilling.stripe ? { ...existingBilling.stripe } : {};

  await prisma.organizationBilling.update({
    where: { organizationId },
    data: {
      stripe: {
        ...nextStripeSnapshot,
        pendingChange,
        lastSyncedAt: new Date().toISOString(),
      },
    },
  });

  await invalidateOrganizationBillingCache(organizationId);
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

const hydratePrices = async <
  TPriceContainer extends {
    price: string | Stripe.Price | Stripe.DeletedPrice;
  },
>(
  items: TPriceContainer[]
): Promise<Array<TPriceContainer & { price: Stripe.Price }>> => {
  if (!stripeClient || items.length === 0) {
    return items.filter(
      (item): item is TPriceContainer & { price: Stripe.Price } =>
        typeof item.price !== "string" && !item.price.deleted
    );
  }
  const client = stripeClient;

  const missingPriceIds = [
    ...new Set(items.flatMap((item) => (typeof item.price === "string" ? [item.price] : []))),
  ];

  const retrievedPrices = await Promise.all(
    missingPriceIds.map(
      async (priceId) =>
        [
          priceId,
          await client.prices.retrieve(priceId, {
            expand: ["product"],
          }),
        ] as const
    )
  );

  const pricesById = new Map(retrievedPrices);

  return items.flatMap((item) => {
    if (typeof item.price !== "string") {
      if (item.price.deleted) {
        return [];
      }

      return [{ ...item, price: item.price }];
    }

    const price = pricesById.get(item.price);
    if (!price) {
      return [];
    }

    return [{ ...item, price }];
  });
};

const getBasePriceFromSubscription = (
  subscription: {
    items: {
      data: Array<{
        id?: string;
        price: Stripe.Price;
      }>;
    };
  } | null
): Stripe.Price | null => {
  if (!subscription) {
    return null;
  }

  return (
    subscription.items.data.find((item) => {
      const plan = getPlanFromPrice(item.price);
      const kind = getPriceKindFromPrice(item.price);

      return plan !== null && kind === "base";
    })?.price ?? null
  );
};

const resolveSubscriptionInterval = (
  subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>
): TCloudBillingInterval | null => {
  return getIntervalFromPrice(getBasePriceFromSubscription(subscription));
};

const mapSubscriptionItemsToScheduleItems = (
  items: Array<{
    price: Stripe.Price;
    quantity?: number | null;
  }>
): Array<Stripe.SubscriptionScheduleUpdateParams.Phase.Item> => {
  return items.map((item) => {
    const scheduleItem: Stripe.SubscriptionScheduleUpdateParams.Phase.Item = {
      price: item.price.id,
    };

    if (item.price.recurring?.usage_type !== "metered") {
      scheduleItem.quantity = item.quantity ?? 1;
    }

    return scheduleItem;
  });
};

const getPendingPlanChangeFromSchedule = async (
  subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>
): Promise<TOrganizationStripePendingChange | null> => {
  if (!stripeClient || !subscription?.schedule) {
    return null;
  }

  const scheduleId =
    typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
  const schedule = await stripeClient.subscriptionSchedules.retrieve(scheduleId);
  const currentPhaseEnd = schedule.current_phase?.end_date ?? null;

  if (!currentPhaseEnd) {
    return null;
  }

  const nextPhase = schedule.phases.find((phase) => phase.start_date >= currentPhaseEnd);
  if (!nextPhase) {
    return null;
  }

  const phaseItems = await hydratePrices(
    nextPhase.items.map((item) => ({
      price: item.price,
      quantity: item.quantity,
    }))
  );

  const basePrice = phaseItems.find((item) => getPriceKindFromPrice(item.price) === "base")?.price ?? null;
  const targetPlan = getPlanFromPrice(basePrice);

  if (!targetPlan) {
    return null;
  }

  return {
    type: "plan_change",
    targetPlan,
    targetInterval: getIntervalFromPrice(basePrice),
    effectiveAt: new Date(nextPhase.start_date * 1000).toISOString(),
  };
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
    expand: ["data.schedule"],
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

const resolvePendingChangeEffectiveAt = (
  subscription: Awaited<ReturnType<typeof resolveCurrentSubscription>>
): string | null => {
  if (!subscription) {
    return null;
  }

  if (subscription.cancel_at) {
    return new Date(subscription.cancel_at * 1000).toISOString();
  }

  const currentPeriodEnd = subscription.items.data.reduce<number | null>((latestEnd, item) => {
    const itemPeriodEnd = item.current_period_end ?? null;

    if (itemPeriodEnd == null) {
      return latestEnd;
    }

    return latestEnd == null ? itemPeriodEnd : Math.max(latestEnd, itemPeriodEnd);
  }, null);

  return currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null;
};

const ensureHobbySubscription = async (
  organizationId: string,
  customerId: string,
  idempotencySuffix: string
): Promise<void> => {
  if (!stripeClient) return;
  const hobbyItems = await getCatalogItemsForPlan("hobby", "monthly");

  await stripeClient.subscriptions.create(
    {
      customer: customerId,
      items: hobbyItems,
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
  const proCatalogItem = await getCatalogItemForPlan("pro", "monthly");
  const proProductId =
    typeof proCatalogItem.basePrice.product === "string"
      ? proCatalogItem.basePrice.product
      : proCatalogItem.basePrice.product.id;

  const customer = await stripeClient.customers.retrieve(customerId);
  if (!customer.deleted && customer.email) {
    const alreadyUsed = await hasEmailUsedProTrial(customer.email, proProductId);
    if (alreadyUsed) {
      throw new OperationNotAllowedError("trial_already_used");
    }
  }

  await stripeClient.subscriptions.create(
    {
      customer: customerId,
      items: await getCatalogItemsForPlan("pro", "monthly"),
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

export const createPaidPlanCheckoutSession = async (input: {
  organizationId: string;
  customerId: string;
  environmentId: string;
  plan: Exclude<TStandardCloudPlan, "hobby">;
  interval: TCloudBillingInterval;
}): Promise<string> => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured");
  }

  const catalogItem = await getCatalogItemForPlan(input.plan, input.interval);
  const checkoutIntervals = new Set<Stripe.Price.Recurring.Interval>(
    [catalogItem.basePrice.recurring?.interval, catalogItem.responsePrice?.recurring?.interval].filter(
      (interval): interval is Stripe.Price.Recurring.Interval => interval != null
    )
  );

  if (checkoutIntervals.size > 1) {
    throw new OperationNotAllowedError("mixed_interval_checkout_unsupported");
  }

  const items = await getCatalogItemsForPlan(input.plan, input.interval);
  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId,
    line_items: items,
    client_reference_id: input.organizationId,
    billing_address_collection: "required",
    tax_id_collection: {
      enabled: true,
      required: "if_supported",
    },
    customer_update: {
      address: "auto",
      name: "auto",
    },
    success_url: `${WEBAPP_URL}/billing-confirmation?environmentId=${input.environmentId}&checkout_success=1`,
    cancel_url: `${WEBAPP_URL}/environments/${input.environmentId}/settings/billing`,
    metadata: {
      organizationId: input.organizationId,
      targetPlan: input.plan,
      targetInterval: input.interval,
    },
    subscription_data: {
      metadata: {
        organizationId: input.organizationId,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL");
  }

  return session.url;
};

const getRequiredActiveSubscription = async (
  organizationId: string,
  customerId: string
): Promise<NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>> => {
  const subscription = await resolveCurrentSubscription(customerId);

  if (!subscription) {
    throw new ResourceNotFoundError("subscription", organizationId);
  }

  return subscription;
};

const clearPendingPlanState = async (
  organizationId: string,
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>
): Promise<void> => {
  if (!stripeClient) {
    return;
  }

  if (subscription.cancel_at_period_end) {
    await stripeClient.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });
  }

  if (subscription.schedule) {
    const scheduleId =
      typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;

    await stripeClient.subscriptionSchedules.release(scheduleId, {
      preserve_cancel_date: false,
    });
  }

  await updatePendingPlanChangeSnapshot(organizationId, null);
};

const updateSubscriptionItemsImmediately = async (
  organizationId: string,
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>,
  targetPlan: TStandardCloudPlan,
  targetInterval: TCloudBillingInterval
): Promise<void> => {
  if (!stripeClient) {
    return;
  }

  const targetItems = await getCatalogItemsForPlan(targetPlan, targetInterval);
  const existingDeletions = subscription.items.data.map((item) => ({
    id: item.id,
    deleted: true as const,
  }));

  await stripeClient.subscriptions.update(subscription.id, {
    cancel_at_period_end: false,
    items: [...existingDeletions, ...targetItems],
    proration_behavior: "always_invoice",
    // We don't grant the upgraded plan until Stripe can actually collect the prorated invoice.
    payment_behavior: "error_if_incomplete",
    ...(subscription.trial_end ? { trial_end: subscription.trial_end } : {}),
    metadata: {
      organizationId,
    },
  });
};

const getScheduleItemsForPlanChange = async (
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>,
  targetPlan: TStandardCloudPlan,
  targetInterval: TCloudBillingInterval
) => {
  const currentItems = mapSubscriptionItemsToScheduleItems(subscription.items.data);
  const targetCatalogItem = await getCatalogItemForPlan(targetPlan, targetInterval);
  const targetItems = mapSubscriptionItemsToScheduleItems([
    { price: targetCatalogItem.basePrice, quantity: 1 },
    ...(targetCatalogItem.responsePrice ? [{ price: targetCatalogItem.responsePrice }] : []),
  ]);

  return { currentItems, targetItems };
};

const getOrCreatePlanChangeSchedule = async (
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>
) => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured");
  }

  const existingScheduleId =
    typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id;

  if (existingScheduleId) {
    return {
      schedule: await stripeClient.subscriptionSchedules.retrieve(existingScheduleId),
      createdSchedule: false,
    };
  }

  return {
    schedule: await stripeClient.subscriptionSchedules.create({
      // Stripe rejects metadata when cloning from an existing subscription.
      from_subscription: subscription.id,
    }),
    createdSchedule: true,
  };
};

const getCurrentSchedulePhase = (schedule: Stripe.SubscriptionSchedule) => {
  const currentPhase = schedule.current_phase;

  if (!currentPhase) {
    throw new Error(`Stripe subscription schedule ${schedule.id} has no current phase`);
  }

  if (!currentPhase.end_date) {
    throw new Error(
      `Stripe subscription schedule ${schedule.id} current phase has no end date; cannot schedule a plan change`
    );
  }

  return currentPhase;
};

const buildPlanChangePhases = (input: {
  currentPhase: { start_date: number; end_date: number };
  currentItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[];
  targetItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[];
  organizationId: string;
  targetPlan: TStandardCloudPlan;
  targetInterval: TCloudBillingInterval;
}) => {
  const { currentPhase, currentItems, targetItems, organizationId, targetPlan, targetInterval } = input;

  return [
    {
      start_date: currentPhase.start_date,
      end_date: currentPhase.end_date,
      items: currentItems,
    },
    {
      start_date: currentPhase.end_date,
      items: targetItems,
      metadata: {
        organizationId,
        targetPlan,
        targetInterval,
      },
    },
  ];
};

const rollbackFailedPlanChangeScheduleUpdate = async (input: {
  organizationId: string;
  subscriptionId: string;
  scheduleId: string;
  createdSchedule: boolean;
  hadCancelAtPeriodEnd: boolean;
}) => {
  const { organizationId, subscriptionId, scheduleId, createdSchedule, hadCancelAtPeriodEnd } = input;

  if (!stripeClient) {
    return;
  }

  if (createdSchedule) {
    try {
      await stripeClient.subscriptionSchedules.release(scheduleId, {
        preserve_cancel_date: false,
      });
    } catch (releaseError) {
      logger.error(
        { error: releaseError, organizationId, scheduleId },
        "Failed to release newly created Stripe schedule after plan change update error"
      );
    }
  }

  if (!hadCancelAtPeriodEnd) {
    return;
  }

  try {
    await stripeClient.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } catch (restoreError) {
    logger.error(
      { error: restoreError, organizationId, subscriptionId },
      "Failed to restore Stripe cancel_at_period_end after plan change scheduling error"
    );
  }
};

const scheduleSubscriptionPlanChange = async (
  organizationId: string,
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>,
  targetPlan: TStandardCloudPlan,
  targetInterval: TCloudBillingInterval
): Promise<TOrganizationStripePendingChange> => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured");
  }

  const hadCancelAtPeriodEnd = subscription.cancel_at_period_end;
  if (hadCancelAtPeriodEnd) {
    await stripeClient.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });
  }

  const { currentItems, targetItems } = await getScheduleItemsForPlanChange(
    subscription,
    targetPlan,
    targetInterval
  );
  const { schedule, createdSchedule } = await getOrCreatePlanChangeSchedule(subscription);
  const currentPhase = getCurrentSchedulePhase(schedule);

  let updatedSchedule: Stripe.SubscriptionSchedule;

  try {
    updatedSchedule = await stripeClient.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      metadata: {
        organizationId,
      },
      proration_behavior: "none",
      phases: buildPlanChangePhases({
        currentPhase,
        currentItems,
        targetItems,
        organizationId,
        targetPlan,
        targetInterval,
      }),
    });
  } catch (error) {
    await rollbackFailedPlanChangeScheduleUpdate({
      organizationId,
      subscriptionId: subscription.id,
      scheduleId: schedule.id,
      createdSchedule,
      hadCancelAtPeriodEnd,
    });

    throw error;
  }

  const nextPhase = updatedSchedule.phases.find((phase) => phase.start_date >= currentPhase.end_date);
  if (!nextPhase) {
    throw new Error(`Stripe subscription schedule ${updatedSchedule.id} has no next phase`);
  }

  const pendingChange: TOrganizationStripePendingChange = {
    type: "plan_change",
    targetPlan,
    targetInterval: targetPlan === "hobby" ? "monthly" : targetInterval,
    effectiveAt: new Date(nextPhase.start_date * 1000).toISOString(),
  };

  await updatePendingPlanChangeSnapshot(organizationId, pendingChange);

  return pendingChange;
};

export const switchOrganizationToCloudPlan = async (input: {
  organizationId: string;
  customerId: string;
  targetPlan: TStandardCloudPlan;
  targetInterval: TCloudBillingInterval;
}): Promise<{ mode: "immediate" | "scheduled"; pendingChange: TOrganizationStripePendingChange | null }> => {
  const subscription = await getRequiredActiveSubscription(input.organizationId, input.customerId);
  const currentPlan = resolveCloudPlanFromSubscription(subscription);
  const currentInterval = resolveSubscriptionInterval(subscription);

  const isImmediateUpgrade = CLOUD_PLAN_LEVEL[input.targetPlan] > CLOUD_PLAN_LEVEL[currentPlan];
  const isSameSelection = currentPlan === input.targetPlan && currentInterval === input.targetInterval;

  if (isSameSelection) {
    return { mode: "immediate", pendingChange: null };
  }

  if (isImmediateUpgrade) {
    await updateSubscriptionItemsImmediately(
      input.organizationId,
      subscription,
      input.targetPlan,
      input.targetInterval
    );

    if (subscription.schedule) {
      await clearPendingPlanState(input.organizationId, subscription);
    }

    return { mode: "immediate", pendingChange: null };
  }

  const pendingChange = await scheduleSubscriptionPlanChange(
    input.organizationId,
    subscription,
    input.targetPlan,
    input.targetInterval
  );
  return { mode: "scheduled", pendingChange };
};

export const undoPendingOrganizationPlanChange = async (
  organizationId: string,
  customerId: string
): Promise<void> => {
  const subscription = await getRequiredActiveSubscription(organizationId, customerId);
  await clearPendingPlanState(organizationId, subscription);
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

  const owner = await getOrganizationOwner(organization.id);
  if (!owner) {
    logger.error({ organizationId }, "Cannot set up Stripe customer: organization has no owner");
    return { customerId: null };
  }

  const { email: ownerEmail, name: ownerName } = owner;
  const customer = await stripeClient.customers.create(
    {
      name: ownerName ?? undefined,
      email: ownerEmail,
      metadata: { organizationId: organization.id, organizationName: organization.name },
    },
    { idempotencyKey: `ensure-customer-${organization.id}` }
  );

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
      stripe: { plan: "hobby", lastSyncedAt: new Date().toISOString() },
    },
    update: {
      stripeCustomerId: customer.id,
      stripe: { plan: "hobby", lastSyncedAt: new Date().toISOString() },
    },
  });

  await invalidateOrganizationBillingCache(organization.id);
  return { customerId: customer.id };
};

const shouldSkipStripeSyncForEvent = (
  existingStripeSnapshot: TOrganizationBilling["stripe"],
  event?: { id: string; created: number }
) => {
  const previousEventDate = getDateFromBilling(existingStripeSnapshot?.lastStripeEventCreatedAt ?? null);
  const incomingEventDate = event ? new Date(event.created * 1000) : null;

  if (event?.id && existingStripeSnapshot?.lastSyncedEventId === event.id) {
    return { shouldSkip: true as const, previousEventDate, incomingEventDate };
  }

  if (incomingEventDate && previousEventDate && incomingEventDate < previousEventDate) {
    return { shouldSkip: true as const, previousEventDate, incomingEventDate };
  }

  return { shouldSkip: false as const, previousEventDate, incomingEventDate };
};

const resolveEntitlementDrivenLimits = (
  organizationId: string,
  customerId: string,
  cloudPlan: TCloudBillingPlan,
  featureLookupKeys: string[],
  previousLimits: TOrganizationBilling["limits"]
) => {
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

  return {
    projects: projectsLimit,
    monthly: {
      responses: responsesIncludedLimit,
    },
  };
};

const resolvePendingPlanChange = async (subscription: Stripe.Subscription | null) => {
  const pendingChangeEffectiveAt = resolvePendingChangeEffectiveAt(subscription);

  const scheduledPlanChange = await getPendingPlanChangeFromSchedule(subscription);
  if (scheduledPlanChange) {
    return scheduledPlanChange;
  }

  if (subscription?.cancel_at_period_end && pendingChangeEffectiveAt) {
    return {
      type: "plan_change" as const,
      targetPlan: "hobby" as const,
      targetInterval: "monthly" as const,
      effectiveAt: pendingChangeEffectiveAt,
    };
  }

  return null;
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
  const { shouldSkip, previousEventDate, incomingEventDate } = shouldSkipStripeSyncForEvent(
    existingStripeSnapshot,
    event
  );
  if (shouldSkip) {
    return billing;
  }

  const [subscription, featureLookupKeys] = await Promise.all([
    resolveCurrentSubscription(customerId),
    listAllActiveEntitlements(customerId),
  ]);

  const cloudPlan = resolveCloudPlanFromSubscription(subscription);
  const billingInterval = resolveSubscriptionInterval(subscription);
  const subscriptionStatus = resolveSubscriptionStatus(subscription);
  const usageCycleAnchor = resolveUsageCycleAnchor(subscription);
  const pendingChange = await resolvePendingPlanChange(subscription);
  const limits = resolveEntitlementDrivenLimits(
    organizationId,
    customerId,
    cloudPlan,
    featureLookupKeys,
    billing.limits
  );

  const updatedBilling: TOrganizationBilling = {
    stripeCustomerId: customerId,
    limits,
    usageCycleAnchor,
    stripe: {
      ...billing.stripe,
      plan: cloudPlan,
      interval: billingInterval,
      subscriptionStatus,
      subscriptionId: subscription?.id ?? null,
      hasPaymentMethod: subscription?.default_payment_method != null,
      features: featureLookupKeys,
      pendingChange,
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
  await reconcileCloudStripeSubscriptionsForOrganization(organizationId, "bootstrap");
  await syncOrganizationBillingFromStripe(organizationId);
};
