import "server-only";
import Stripe from "stripe";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  type TCloudBillingInterval,
  type TCloudBillingPlan,
  type TOrganizationBilling,
  type TOrganizationStripeBilling,
  type TOrganizationStripePendingChange,
  type TOrganizationStripeSubscriptionStatus,
} from "@formbricks/types/organizations";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
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
// Single-flight lock TTL for the stale read-through Stripe sync: long enough to cover a few Stripe
// round-trips + the write, short enough that a crashed holder can't block refreshes for long. The
// lock is released by expiry (no explicit unlock), matching the license-fetch pattern.
const BILLING_SYNC_LOCK_TTL_MS = 30 * 1000;
// Hard deadline for the read-through sync, strictly below the lock TTL. This runs on a hot render
// path, so if Stripe is slow we stop waiting and serve the cached snapshot instead of blocking the
// request. Because the OrganizationBilling write is idempotent (Stripe is the source of truth;
// last-write-wins on a single row), a sync that finishes after the deadline — or after the lease
// expires — can't corrupt data or deadlock, so a lease heartbeat isn't needed.
const BILLING_SYNC_DEADLINE_MS = 20 * 1000;

/** A promise that rejects after `ms`, with a canceller so the timer never outlives the race. */
const rejectAfter = (ms: number, message: string): { promise: Promise<never>; cancel: () => void } => {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
};
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
    workspaces: IS_FORMBRICKS_CLOUD ? 1 : 3,
    monthly: {
      responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
      // No included workflow runs by default — the Scale entitlement grants the volume, and
      // self-hosted gates workflows by the boolean license feature rather than metering.
      workflowRuns: null,
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

const isPaidCloudPlan = (plan: TCloudBillingPlan | null | undefined): boolean =>
  plan === "pro" || plan === "scale";

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
  subscriptionCount: number
): Promise<void> => {
  if (!stripeClient) return;
  const hobbyItems = await getCatalogItemsForPlan("hobby", "monthly");

  // subscriptionCount in the key: stable across concurrent calls (dedup), but bumps after a
  // cancellation so re-creation isn't blocked by the old key.
  await stripeClient.subscriptions.create(
    {
      customer: customerId,
      items: hobbyItems,
      metadata: { organizationId },
    },
    { idempotencyKey: `ensure-hobby-subscription-${organizationId}-${subscriptionCount}` }
  );
};

/** Whether this email has already used a Pro trial, across all Stripe customers sharing it. */
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
  plan: Exclude<TStandardCloudPlan, "hobby">;
  interval: TCloudBillingInterval;
}): Promise<string> => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured");
  }

  const catalogItem = await getCatalogItemForPlan(input.plan, input.interval);
  const checkoutIntervals = new Set<Stripe.Price.Recurring.Interval>(
    [
      catalogItem.basePrice.recurring?.interval,
      catalogItem.responsePrice?.recurring?.interval,
      catalogItem.workflowRunsPrice?.recurring?.interval,
    ].filter((interval): interval is Stripe.Price.Recurring.Interval => interval != null)
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
    // Carries the purchased plan so the confirmation page can force a Stripe sync — the read-
    // through sync only refreshes a >5min-stale snapshot and would otherwise serve the old plan.
    success_url: `${WEBAPP_URL}/billing-confirmation?organizationId=${input.organizationId}&checkout_success=1&plan=${input.plan}`,
    cancel_url: `${WEBAPP_URL}/organizations/${input.organizationId}/settings/billing`,
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

// When the prorated upgrade invoice needs 3D Secure, `clientSecret` carries the invoice
// PaymentIntent secret for on-session confirmation; otherwise both are null/false.
export type TUpgradePaymentConfirmation = {
  clientSecret: string | null;
  requiresAction: boolean;
};

// Invoice amount from Stripe (includes tax and metered usage, unlike the catalog list price). Shared
// by the trial-conversion and plain-upgrade previews. Returns null only when Stripe isn't configured;
// throws if Stripe can't price the invoice — callers needing a fallback must catch.
const previewFullConversionChargeCents = async (
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>,
  customerId: string,
  targetPlan: Exclude<TStandardCloudPlan, "hobby">,
  targetInterval: TCloudBillingInterval
): Promise<{ amountDue: number; currency: string } | null> => {
  if (!stripeClient) return null;
  const targetItems = await getCatalogItemsForPlan(targetPlan, targetInterval);
  const existingDeletions = subscription.items.data.map((item) => ({ id: item.id, deleted: true as const }));
  const preview = await stripeClient.invoices.createPreview({
    customer: customerId,
    subscription: subscription.id,
    subscription_details: {
      items: [...existingDeletions, ...targetItems],
      proration_behavior: "always_invoice",
      // Only for trialing: ending the trial resets the cycle and bills a full period, so the preview
      // must mirror that. Never send it otherwise — trial_end re-anchors the billing cycle, which
      // would turn an ordinary mid-cycle proration into a full-period charge (matches the real update
      // in updateSubscriptionItemsImmediately, which sends no trial_end when not trialing).
      ...(subscription.status === "trialing" ? { trial_end: "now" as const } : {}),
    },
  });
  return { amountDue: preview.amount_due, currency: preview.currency };
};

// Codes meaning the card needs cardholder authentication off-session. error_if_incomplete rolls the
// update back (no PaymentIntent survives to confirm), so the only useful action is a distinct error.
const CARD_AUTHENTICATION_ERROR_CODES = new Set([
  "authentication_required",
  "subscription_payment_intent_requires_action",
]);

const toTrialConversionError = (error: unknown): unknown => {
  const code = (error as { code?: string } | null)?.code;
  const declineCode = (error as { decline_code?: string } | null)?.decline_code;
  if (
    (code && CARD_AUTHENTICATION_ERROR_CODES.has(code)) ||
    (declineCode && CARD_AUTHENTICATION_ERROR_CODES.has(declineCode))
  ) {
    return new OperationNotAllowedError("card_authentication_required");
  }
  return error;
};

const updateSubscriptionItemsImmediately = async (
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>,
  targetPlan: TStandardCloudPlan,
  targetInterval: TCloudBillingInterval
): Promise<TUpgradePaymentConfirmation> => {
  if (!stripeClient) {
    return { clientSecret: null, requiresAction: false };
  }

  const targetItems = await getCatalogItemsForPlan(targetPlan, targetInterval);
  const existingDeletions = subscription.items.data.map((item) => ({
    id: item.id,
    deleted: true as const,
  }));

  // Not a pending-update attribute, so clear it in a separate plain update first.
  if (subscription.cancel_at_period_end) {
    await stripeClient.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });
  }

  // Ends the trial and switches plans in a SINGLE update so the card is billed exactly once for the
  // target plan — two updates would double-invoice (trial-end bills the old plan, item change bills
  // the new one). error_if_incomplete charges synchronously and throws on decline, so a bad card
  // blocks the upgrade instead of granting access on an unpaid invoice.
  //
  // Trade-off: a card needing off-session 3DS also errors here (the update rolls back before the
  // browser can confirm, leaving no PaymentIntent) — translated into a distinct error via
  // toTrialConversionError so the UI can ask for a non-3DS card.
  if (subscription.status === "trialing") {
    try {
      await stripeClient.subscriptions.update(subscription.id, {
        items: [...existingDeletions, ...targetItems],
        trial_end: "now",
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      });
    } catch (error) {
      throw toTrialConversionError(error);
    }
    return { clientSecret: null, requiresAction: false };
  }

  const updated = await stripeClient.subscriptions.update(subscription.id, {
    items: [...existingDeletions, ...targetItems],
    proration_behavior: "always_invoice",
    // Records a pending_update; the plan isn't granted until the invoice is paid (SCA-safe).
    // Only pending-update-supported attributes are allowed (no metadata/cancel_at_period_end).
    payment_behavior: "pending_if_incomplete",
  });

  const invoiceId =
    typeof updated.latest_invoice === "string"
      ? updated.latest_invoice
      : (updated.latest_invoice?.id ?? null);

  if (!invoiceId) {
    return { clientSecret: null, requiresAction: false };
  }

  // In this API version the PI client secret lives on invoice.confirmation_secret (expand-only).
  const invoice = await stripeClient.invoices.retrieve(invoiceId, {
    expand: ["confirmation_secret"],
  });
  const clientSecret = invoice.confirmation_secret?.client_secret ?? null;

  return { clientSecret, requiresAction: clientSecret != null };
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
    ...(targetCatalogItem.workflowRunsPrice ? [{ price: targetCatalogItem.workflowRunsPrice }] : []),
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

/**
 * Whether a payment method is on file: subscription default first, falling back to the customer
 * default so a card saved on the customer but not yet attached to the subscription still counts.
 */
const hasCollectedPaymentMethod = async (
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>,
  customerId: string
): Promise<boolean> => {
  if (subscription.default_payment_method != null) {
    return true;
  }

  if (!stripeClient) {
    return false;
  }

  const customer = await stripeClient.customers.retrieve(customerId);
  if (customer.deleted) {
    return false;
  }

  return customer.invoice_settings?.default_payment_method != null;
};

/**
 * A Pro trial opting back to Hobby switches immediately: end the trial now and move to the free
 * Hobby plan in a single update. Hobby is free, so proration_behavior "none" keeps the switch
 * charge-free and no card is required. Scheduling instead (the paid-plan path) would strand the user
 * on a paid trial they explicitly left. Any stray schedule/cancel flag is cleared first so it can't
 * rebuild the Pro phase, and the pending-change snapshot is nulled.
 */
const switchTrialToHobbyImmediately = async (
  organizationId: string,
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>
): Promise<void> => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured");
  }

  if (subscription.schedule) {
    const scheduleId =
      typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
    await stripeClient.subscriptionSchedules.release(scheduleId, {
      preserve_cancel_date: false,
    });
  }

  // cancel_at_period_end isn't a pending-update attribute, so clear it in a separate plain update first.
  if (subscription.cancel_at_period_end) {
    await stripeClient.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });
  }

  const hobbyItems = await getCatalogItemsForPlan("hobby", "monthly");
  const existingDeletions = subscription.items.data.map((item) => ({
    id: item.id,
    deleted: true as const,
  }));

  // trial_end "now" ends the trial and activates Hobby immediately; proration_behavior "none" keeps
  // the switch free (no early trial charge on the outgoing Pro items).
  //
  // The Pro trial was created with trial_settings.end_behavior.missing_payment_method "cancel"
  // (createProTrialSubscription), so ending the trial on a no-card org would CANCEL the subscription
  // instead of leaving it on Hobby — stranding a canceled subscriptionId that then breaks the next
  // upgrade. Hobby is free, so override to "create_invoice": the trial ends into an active $0 Hobby
  // subscription with no payment method required.
  await stripeClient.subscriptions.update(subscription.id, {
    items: [...existingDeletions, ...hobbyItems],
    trial_end: "now",
    proration_behavior: "none",
    trial_settings: { end_behavior: { missing_payment_method: "create_invoice" } },
  });

  await updatePendingPlanChangeSnapshot(organizationId, null);
};

// Immediate upgrade / trial conversion: bills the full target-plan price via a single Stripe update,
// then clears any pending downgrade. Extracted from switchOrganizationToCloudPlan for Sonar's
// complexity budget.
const performImmediateUpgradeOrTrialConversion = async (input: {
  organizationId: string;
  customerId: string;
  subscription: NonNullable<Awaited<ReturnType<typeof resolveCurrentSubscription>>>;
  targetPlan: TStandardCloudPlan;
  targetInterval: TCloudBillingInterval;
}): Promise<{
  mode: "immediate";
  pendingChange: null;
  clientSecret: string | null;
  requiresAction: boolean;
}> => {
  const { organizationId, subscription, targetPlan, targetInterval } = input;

  const confirmation = await updateSubscriptionItemsImmediately(subscription, targetPlan, targetInterval);

  // Supersedes any pending downgrade (e.g. a no-card-trial "Return to Hobby" via cancel_at_period_end,
  // no schedule) unconditionally: releases any schedule, undoes cancel_at_period_end, and nulls the
  // pending-change snapshot so a stale "Scheduled" badge can't survive the upgrade. Safe to repeat
  // even though updateSubscriptionItemsImmediately already cleared cancel_at_period_end for trialing.
  await clearPendingPlanState(organizationId, subscription);

  return {
    mode: "immediate",
    pendingChange: null,
    clientSecret: confirmation.clientSecret,
    requiresAction: confirmation.requiresAction,
  };
};

export const switchOrganizationToCloudPlan = async (input: {
  organizationId: string;
  customerId: string;
  targetPlan: TStandardCloudPlan;
  targetInterval: TCloudBillingInterval;
}): Promise<{
  mode: "immediate" | "scheduled";
  pendingChange: TOrganizationStripePendingChange | null;
  clientSecret?: string | null;
  requiresAction?: boolean;
}> => {
  const subscription = await getRequiredActiveSubscription(input.organizationId, input.customerId);
  const currentPlan = resolveCloudPlanFromSubscription(subscription);
  const currentInterval = resolveSubscriptionInterval(subscription);

  // Non-standard plans (custom, unknown) skip the tier hierarchy — any switch off them applies immediately.
  const isNonStandardCurrentPlan = currentPlan === "custom" || currentPlan === "unknown";
  const isImmediateUpgrade =
    isNonStandardCurrentPlan || CLOUD_PLAN_LEVEL[input.targetPlan] > CLOUD_PLAN_LEVEL[currentPlan];
  const isSameSelection = currentPlan === input.targetPlan && currentInterval === input.targetInterval;
  // Converting an active trial to any paid plan is a real state change even when the plan/interval
  // match what is being trialed (trial Pro -> paid Pro): it ends the trial and bills the card now.
  const isTrialConversion = subscription.status === "trialing" && input.targetPlan !== "hobby";

  // A same plan+interval selection is a no-op — except a trial conversion, which must still charge.
  if (isSameSelection && !isTrialConversion) {
    return { mode: "immediate", pendingChange: null, clientSecret: null, requiresAction: false };
  }

  // Trial -> Hobby switches immediately to the free Hobby plan (no schedule, no charge): the user
  // opted out of the paid trial, so there's nothing to keep them on until period end. Scheduling here
  // would also be unsafe — the scheduled path lacks the trial guard, so phase 1 would become a
  // billable Pro phase (charging the trial early). Correct regardless of card on file.
  if (subscription.status === "trialing" && input.targetPlan === "hobby") {
    await switchTrialToHobbyImmediately(input.organizationId, subscription);
    return { mode: "immediate", pendingChange: null, clientSecret: null, requiresAction: false };
  }

  // No card on file: never convert a trial to billable — reject and route through add-card checkout instead.
  if (
    subscription.status === "trialing" &&
    !(await hasCollectedPaymentMethod(subscription, input.customerId))
  ) {
    throw new OperationNotAllowedError("payment_method_required");
  }

  if (isImmediateUpgrade || isTrialConversion) {
    return performImmediateUpgradeOrTrialConversion({
      organizationId: input.organizationId,
      customerId: input.customerId,
      subscription,
      targetPlan: input.targetPlan,
      targetInterval: input.targetInterval,
    });
  }

  const pendingChange = await scheduleSubscriptionPlanChange(
    input.organizationId,
    subscription,
    input.targetPlan,
    input.targetInterval
  );
  return { mode: "scheduled", pendingChange, clientSecret: null, requiresAction: false };
};

// Previews the invoice an immediate upgrade or trial conversion would generate; mirrors
// updateSubscriptionItemsImmediately so the amount matches the real charge (estimate — final invoice
// is authoritative). Returns null when Stripe can't price the invoice (it can fail on usage-based
// line items) — the modal then falls back to amount-less copy, never a fabricated number.
export const previewImmediateUpgradeCharge = async (input: {
  organizationId: string;
  customerId: string;
  targetPlan: Exclude<TStandardCloudPlan, "hobby">;
  targetInterval: TCloudBillingInterval;
}): Promise<{
  amountDue: number;
  currency: string;
} | null> => {
  if (!stripeClient) {
    return null;
  }

  const subscription = await getRequiredActiveSubscription(input.organizationId, input.customerId);

  return await previewFullConversionChargeCents(
    subscription,
    input.customerId,
    input.targetPlan,
    input.targetInterval
  ).catch((error: unknown) => {
    logger.warn(
      { error, organizationId: input.organizationId, targetPlan: input.targetPlan },
      "Upgrade invoice preview failed; the confirmation modal falls back to amount-less copy"
    );
    return null;
  });
};

export const undoPendingOrganizationPlanChange = async (
  organizationId: string,
  customerId: string
): Promise<void> => {
  const subscription = await getRequiredActiveSubscription(organizationId, customerId);
  await clearPendingPlanState(organizationId, subscription);
};

const isValidSetupCheckoutUpgradeTarget = (
  targetPlan?: string
): targetPlan is Exclude<TStandardCloudPlan, "hobby"> => {
  return targetPlan === "pro" || targetPlan === "scale";
};

export type TSetupCheckoutUpgradeResult = {
  mode: "immediate" | "scheduled";
  clientSecret: string | null;
  requiresAction: boolean;
  targetPlan: Exclude<TStandardCloudPlan, "hobby"> | null;
};

const NO_SETUP_UPGRADE: TSetupCheckoutUpgradeResult = {
  mode: "immediate",
  clientSecret: null,
  requiresAction: false,
  targetPlan: null,
};

/**
 * Finalizes a completed setup-mode Checkout upgrade: attaches the saved card synchronously (no
 * webhook dependency), applies the upgrade, and returns any client_secret for 3DS completion.
 */
export const applySetupCheckoutUpgrade = async (input: {
  organizationId: string;
  checkoutSessionId: string;
}): Promise<TSetupCheckoutUpgradeResult> => {
  if (!stripeClient) return NO_SETUP_UPGRADE;

  const session = await stripeClient.checkout.sessions.retrieve(input.checkoutSessionId, {
    expand: ["setup_intent"],
  });

  if (session.metadata?.organizationId !== input.organizationId) {
    throw new OperationNotAllowedError("checkout_session_mismatch");
  }
  if (session.mode !== "setup" || session.status !== "complete") {
    return NO_SETUP_UPGRADE;
  }

  const targetPlan = session.metadata?.targetPlan;
  if (!isValidSetupCheckoutUpgradeTarget(targetPlan)) {
    return NO_SETUP_UPGRADE;
  }
  const targetInterval: TCloudBillingInterval =
    session.metadata?.targetInterval === "yearly" ? "yearly" : "monthly";

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) {
    throw new ResourceNotFoundError("stripeCustomer", input.organizationId);
  }

  const setupIntent =
    session.setup_intent && typeof session.setup_intent !== "string" ? session.setup_intent : null;
  const paymentMethodId =
    typeof setupIntent?.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent?.payment_method?.id;

  if (paymentMethodId) {
    await stripeClient.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    const subscriptionId = session.metadata?.subscriptionId;
    if (subscriptionId) {
      await stripeClient.subscriptions.update(subscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }
  }

  const result = await switchOrganizationToCloudPlan({
    organizationId: input.organizationId,
    customerId,
    targetPlan,
    targetInterval,
  });

  return {
    mode: result.mode,
    clientSecret: result.clientSecret ?? null,
    requiresAction: result.requiresAction ?? false,
    targetPlan,
  };
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

/** Organization owner's user info, via the membership with role "owner". */
const getOrganizationOwner = async (
  organizationId: string
): Promise<{ id: string; email: string; name: string | null } | null> => {
  const membership = await prisma.membership.findFirst({
    where: { organizationId, role: "owner" },
    select: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!membership) return null;
  return { id: membership.user.id, email: membership.user.email, name: membership.user.name };
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

  // Upsert so the billing row exists and carries the resolved Stripe customer ID.
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
  const workflowRunsIncludedFromEntitlements = parseEntitlementLimit(
    featureLookupKeys,
    "workflow-runs-included-"
  );

  const workspacesLimit =
    workspaceLimitFromEntitlements === undefined
      ? (previousLimits?.workspaces ?? null)
      : workspaceLimitFromEntitlements;

  if (workspaceLimitFromEntitlements === undefined && previousLimits?.workspaces == null) {
    logger.warn(
      { organizationId, customerId, cloudPlan, featureLookupKeys },
      "No workspace limit entitlement found in Stripe entitlements; preserving previous workspaces limit"
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

  // Absent workflow-runs entitlement resolves to null, NOT the previous value: unlike workspaces/
  // responses (present on every plan, so absence signals a bad read worth preserving against), this
  // entitlement only exists on plans with workflows — absence is the normal state, and preserving
  // would keep a stale included volume forever after a downgrade. A transient bad read self-heals
  // on the next sync; `unlimited` still parses to null upstream.
  const workflowRunsIncludedLimit = workflowRunsIncludedFromEntitlements ?? null;

  return {
    workspaces: workspacesLimit,
    monthly: {
      responses: responsesIncludedLimit,
      workflowRuns: workflowRunsIncludedLimit,
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

type TSubscriptionLifecycleTransition = {
  startedPaidSubscription: boolean;
  canceledPaidSubscription: boolean;
  switchedPaidPlan: boolean;
};

const resolveSubscriptionLifecycleTransition = (
  existingStripeSnapshot: TOrganizationBilling["stripe"],
  subscription: Stripe.Subscription | null,
  subscriptionStatus: TOrganizationStripeSubscriptionStatus | null,
  cloudPlan: TCloudStripePlan
): TSubscriptionLifecycleTransition => {
  const wasPaidActive =
    existingStripeSnapshot?.subscriptionStatus === "active" && isPaidCloudPlan(existingStripeSnapshot?.plan);
  const isPaidActive = subscriptionStatus === "active" && isPaidCloudPlan(cloudPlan);
  const recoveredFromDunning =
    existingStripeSnapshot?.subscriptionStatus === "past_due" ||
    existingStripeSnapshot?.subscriptionStatus === "unpaid" ||
    existingStripeSnapshot?.subscriptionStatus === "paused";
  const wasPaidRecoverable =
    isPaidCloudPlan(existingStripeSnapshot?.plan) &&
    (existingStripeSnapshot?.subscriptionStatus === "active" || recoveredFromDunning);
  const subscriptionEnded = !subscription || subscriptionStatus === "canceled" || cloudPlan === "hobby";

  return {
    startedPaidSubscription: isPaidActive && !wasPaidActive && !recoveredFromDunning,
    canceledPaidSubscription: wasPaidRecoverable && subscriptionEnded,
    // Plan switch within an active paid subscription (Pro <-> Scale, either direction).
    switchedPaidPlan: wasPaidActive && isPaidActive && existingStripeSnapshot?.plan !== cloudPlan,
  };
};

// Emit the paid-subscription lifecycle signal, keyed off the org owner so it ties to a person in
// PostHog (with the organization group for company attribution).
const emitSubscriptionLifecycleEvent = async (input: {
  organizationId: string;
  existingStripeSnapshot: TOrganizationBilling["stripe"];
  cloudPlan: TCloudStripePlan;
  billingInterval: TCloudBillingInterval | null;
  transition: TSubscriptionLifecycleTransition;
}): Promise<void> => {
  const { organizationId, existingStripeSnapshot, cloudPlan, billingInterval, transition } = input;
  const { startedPaidSubscription, canceledPaidSubscription, switchedPaidPlan } = transition;

  if (!startedPaidSubscription && !canceledPaidSubscription && !switchedPaidPlan) {
    return;
  }

  // Best-effort: the snapshot is already persisted, so a failure here must not reject the sync — a
  // retry would see no transition and permanently drop the event. Swallow and log instead.
  try {
    const owner = await getOrganizationOwner(organizationId);
    if (!owner) {
      return;
    }

    if (switchedPaidPlan) {
      capturePostHogEvent(
        owner.id,
        "subscription_updated",
        {
          previous_plan: existingStripeSnapshot?.plan ?? null,
          plan: cloudPlan,
          interval: billingInterval,
          organization_id: organizationId,
        },
        { organizationId }
      );
      return;
    }

    capturePostHogEvent(
      owner.id,
      startedPaidSubscription ? "subscription_started" : "subscription_canceled",
      {
        // On cancel the new snapshot has already dropped to hobby/none, so report the prior plan.
        plan: startedPaidSubscription ? cloudPlan : (existingStripeSnapshot?.plan ?? null),
        interval: startedPaidSubscription ? billingInterval : (existingStripeSnapshot?.interval ?? null),
        organization_id: organizationId,
      },
      { organizationId }
    );
  } catch (error) {
    logger.error({ error, organizationId }, "Failed to emit subscription lifecycle event to PostHog");
  }
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
  // Matches the guard in switchOrganizationToCloudPlan: a card on the customer but not yet attached to
  // the subscription still counts, so the cached flag can't falsely block a card-backed org.
  const hasPaymentMethod = subscription ? await hasCollectedPaymentMethod(subscription, customerId) : false;

  const transition = resolveSubscriptionLifecycleTransition(
    existingStripeSnapshot,
    subscription,
    subscriptionStatus,
    cloudPlan
  );

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
      hasPaymentMethod,
      features: featureLookupKeys,
      pendingChange,
      // Clears the payment-failure banner only on a real settlement (webhook event or observed plan
      // change) — a staleness-triggered read-through sync must not silently dismiss a failure.
      paymentAttemptError:
        event || cloudPlan !== existingStripeSnapshot?.plan
          ? null
          : (existingStripeSnapshot?.paymentAttemptError ?? null),
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

  await emitSubscriptionLifecycleEvent({
    organizationId,
    existingStripeSnapshot,
    cloudPlan,
    billingInterval,
    transition,
  });

  return updatedBilling;
};

/**
 * Optimistically adds a feature lookup key to stripe.features right after a subscription change
 * (e.g. starting a trial), so the next render sees it before Stripe's entitlements API propagates.
 * Only the features array is mutated — everything else is preserved verbatim; the subsequent
 * customer.subscription.created webhook re-syncs the full snapshot and converges on the same value.
 */
export const addOptimisticBillingFeature = async (organizationId: string, feature: string): Promise<void> => {
  const billing = await getOrganizationBillingFromDatabase(organizationId);
  if (!billing?.stripe) return;

  const currentFeatures = billing.stripe.features ?? [];
  if (currentFeatures.includes(feature)) return;

  const updatedStripe = {
    ...billing.stripe,
    features: [...currentFeatures, feature],
  };

  await prisma.organizationBilling.update({
    where: { organizationId },
    data: { stripe: updatedStripe },
  });

  await invalidateOrganizationBillingCache(organizationId);
};

/**
 * Set (or clear, via `null`) the payment-failure banner on the billing page.
 * Preserves the rest of the stripe snapshot and invalidates the billing cache.
 */
export const setOrganizationPaymentAttemptError = async (
  organizationId: string,
  paymentAttemptError: TOrganizationStripeBilling["paymentAttemptError"],
  event?: { id: string; created: number }
): Promise<void> => {
  const billing = await ensureOrganizationBillingRecord(organizationId);
  if (!billing) return;

  // Idempotency: ignore a replayed/out-of-order event older than the last processed one, so
  // a stale payment_intent webhook can't resurrect a banner a newer sync already resolved.
  if (event) {
    const lastEventDate = getDateFromBilling(billing.stripe?.lastStripeEventCreatedAt ?? null);
    if (lastEventDate && new Date(event.created * 1000) < lastEventDate) {
      return;
    }
  }

  const nextStripeSnapshot = billing.stripe ? { ...billing.stripe } : {};

  await prisma.organizationBilling.update({
    where: { organizationId },
    data: {
      stripe: {
        ...nextStripeSnapshot,
        paymentAttemptError,
        lastSyncedAt: new Date().toISOString(),
      },
    },
  });

  await invalidateOrganizationBillingCache(organizationId);
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

  const cachedBilling = await cache.withCacheNullable(
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

  // Single-flight the stale refresh: withCache does NOT dedupe concurrent callers, so without this a
  // burst of requests for the same org (e.g. the post-login workspace layout render) would each run
  // the Stripe sync + OrganizationBilling write — a thundering herd and a deadlock surface (ENG-2038).
  // Only the lock winner refreshes; everyone else (incl. the Redis-unavailable case) serves the
  // already-cached snapshot, which is at most one stale cycle old — acceptable for billing display.
  const lockResult = await cache.tryLock(
    createCacheKey.organization.billingSyncLock(organizationId),
    "1",
    BILLING_SYNC_LOCK_TTL_MS
  );
  if (!(lockResult.ok && lockResult.data === true)) {
    return cachedBilling;
  }

  try {
    const syncPromise = syncOrganizationBillingFromStripe(organizationId);
    // Guard against an unhandled rejection if the sync settles after the deadline already won the race.
    syncPromise.catch(() => undefined);
    const deadline = rejectAfter(BILLING_SYNC_DEADLINE_MS, "billing sync exceeded deadline");
    try {
      const syncedBilling = await Promise.race([syncPromise, deadline.promise]);
      return syncedBilling ?? cachedBilling;
    } finally {
      deadline.cancel();
    }
  } catch (error) {
    logger.warn({ error, organizationId }, "Failed to refresh billing snapshot from Stripe");
    return cachedBilling;
  }
};

/**
 * Cancels all active subscriptions after org deletion but keeps the Stripe customer itself, so trial
 * history is preserved and the same email can't claim a free trial again.
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
  organizationId: string
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
      hobbySubscriptions.map(async ({ subscription }) => {
        try {
          await client.subscriptions.cancel(subscription.id, {
            prorate: false,
          });
        } catch (err) {
          if (
            err instanceof Stripe.errors.StripeInvalidRequestError &&
            err.statusCode === 404 &&
            err.code === "resource_missing"
          ) {
            logger.warn(
              { subscriptionId: subscription.id, organizationId },
              "Subscription already deleted, skipping cancel"
            );
            return;
          }
          throw err;
        }
      })
    );
    return;
  }

  if (subscriptionsWithPlanLevel.length === 0) {
    // Re-check active subscriptions to guard against concurrent reconciliation calls
    // (e.g. webhook + bootstrap) both seeing 0 and creating duplicate hobbies.
    const freshSubscriptions = await client.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const freshActive = freshSubscriptions.data.filter((sub) => ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status));

    if (freshActive.length === 0) {
      await ensureHobbySubscription(organizationId, customerId, freshSubscriptions.data.length);
    }
  }
};

export const ensureCloudStripeSetupForOrganization = async (organizationId: string): Promise<void> => {
  if (!IS_FORMBRICKS_CLOUD || !stripeClient) return;
  await ensureStripeCustomerForOrganization(organizationId);
  await reconcileCloudStripeSubscriptionsForOrganization(organizationId);
  await syncOrganizationBillingFromStripe(organizationId);
};
