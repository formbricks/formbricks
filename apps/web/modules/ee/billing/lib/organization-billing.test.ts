import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  addOptimisticBillingFeature,
  applySetupCheckoutUpgrade,
  computeUnusedTrialCreditCents,
  createPaidPlanCheckoutSession,
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  findOrganizationIdByStripeCustomerId,
  getOrganizationBillingWithReadThroughSync,
  previewImmediateUpgradeCharge,
  reconcileCloudStripeSubscriptionsForOrganization,
  setOrganizationPaymentAttemptError,
  switchOrganizationToCloudPlan,
  syncOrganizationBillingFromStripe,
  undoPendingOrganizationPlanChange,
} from "./organization-billing";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  isCloud: true,
  getBillingCacheKey: vi.fn(),
  getCustomCacheKey: vi.fn(),
  prismaOrganizationFindUnique: vi.fn(),
  prismaOrganizationBillingFindUnique: vi.fn(),
  prismaOrganizationBillingCreate: vi.fn(),
  prismaOrganizationBillingUpsert: vi.fn(),
  prismaOrganizationBillingUpdate: vi.fn(),
  cacheWithCache: vi.fn(),
  cacheWithCacheNullable: vi.fn(),
  cacheDel: vi.fn(),
  loggerWarn: vi.fn(),
  getCloudPlanFromProduct: vi.fn(),
  customersCreate: vi.fn(),
  checkoutSessionsCreate: vi.fn(),
  checkoutSessionsRetrieve: vi.fn(),
  invoicesRetrieve: vi.fn(),
  invoicesCreatePreview: vi.fn(),
  customersCreateBalanceTransaction: vi.fn(),
  productsList: vi.fn(),
  productsRetrieve: vi.fn(),
  subscriptionsList: vi.fn(),
  subscriptionsCreate: vi.fn(),
  subscriptionsCancel: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  subscriptionSchedulesCreate: vi.fn(),
  subscriptionSchedulesRetrieve: vi.fn(),
  subscriptionSchedulesUpdate: vi.fn(),
  subscriptionSchedulesRelease: vi.fn(),
  pricesList: vi.fn(),
  pricesRetrieve: vi.fn(),
  entitlementsList: vi.fn(),
  customersList: vi.fn(),
  customersRetrieve: vi.fn(),
  customersUpdate: vi.fn(),
  prismaMembershipFindFirst: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get IS_FORMBRICKS_CLOUD() {
      return mocks.isCloud;
    },
  };
});

vi.mock("@formbricks/cache", () => ({
  createCacheKey: {
    organization: {
      billing: mocks.getBillingCacheKey,
    },
    custom: mocks.getCustomCacheKey,
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findUnique: mocks.prismaOrganizationFindUnique,
    },
    organizationBilling: {
      findUnique: mocks.prismaOrganizationBillingFindUnique,
      create: mocks.prismaOrganizationBillingCreate,
      upsert: mocks.prismaOrganizationBillingUpsert,
      update: mocks.prismaOrganizationBillingUpdate,
    },
    membership: {
      findFirst: mocks.prismaMembershipFindFirst,
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: mocks.cacheWithCache,
    withCacheNullable: mocks.cacheWithCacheNullable,
    del: mocks.cacheDel,
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
}));

vi.mock("./stripe-plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-plan")>();
  return {
    ...actual,
    getCloudPlanFromProduct: mocks.getCloudPlanFromProduct,
  };
});

vi.mock("./stripe-client", () => ({
  stripeClient: {
    customers: {
      create: mocks.customersCreate,
      list: mocks.customersList,
      retrieve: mocks.customersRetrieve,
      update: mocks.customersUpdate,
      createBalanceTransaction: mocks.customersCreateBalanceTransaction,
    },
    products: {
      list: mocks.productsList,
      retrieve: mocks.productsRetrieve,
    },
    checkout: {
      sessions: {
        create: mocks.checkoutSessionsCreate,
        retrieve: mocks.checkoutSessionsRetrieve,
      },
    },
    invoices: {
      retrieve: mocks.invoicesRetrieve,
      createPreview: mocks.invoicesCreatePreview,
    },
    subscriptions: {
      list: mocks.subscriptionsList,
      create: mocks.subscriptionsCreate,
      cancel: mocks.subscriptionsCancel,
      update: mocks.subscriptionsUpdate,
    },
    subscriptionSchedules: {
      create: mocks.subscriptionSchedulesCreate,
      retrieve: mocks.subscriptionSchedulesRetrieve,
      update: mocks.subscriptionSchedulesUpdate,
      release: mocks.subscriptionSchedulesRelease,
    },
    prices: { list: mocks.pricesList, retrieve: mocks.pricesRetrieve },
    entitlements: {
      activeEntitlements: {
        list: mocks.entitlementsList,
      },
    },
  },
}));

describe("organization-billing", () => {
  // Simulates the Stripe customer credit balance: a credit is a NEGATIVE balance, so posting a
  // -4153 balance transaction moves this to -4153. applyUnusedTrialCredit reads the balance back to
  // confirm the credit really landed before letting the charge run, so the mock has to move.
  let stripeCustomerBalanceCents = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    stripeCustomerBalanceCents = 0;
    mocks.isCloud = true;
    mocks.getBillingCacheKey.mockReturnValue("billing-cache-key");
    mocks.getCustomCacheKey.mockImplementation(
      (namespace: string, identifier: string, subresource?: string) =>
        [namespace, identifier, subresource].filter(Boolean).join(":")
    );
    mocks.cacheWithCache.mockImplementation(async (fn: () => Promise<unknown>) => await fn());
    mocks.cacheWithCacheNullable.mockImplementation(async (fn: () => Promise<unknown>) => await fn());
    mocks.getCloudPlanFromProduct.mockReturnValue("pro");
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.customersList.mockResolvedValue({ data: [] });
    // Defaults for the trial-conversion credit path (overridden per-test where relevant).
    mocks.invoicesCreatePreview.mockResolvedValue({ amount_due: 8900, currency: "usd" });
    mocks.customersCreateBalanceTransaction.mockImplementation(
      async (_customerId: string, params: { amount: number }) => {
        stripeCustomerBalanceCents += params.amount;
        return { id: "cbtxn_test", amount: params.amount };
      }
    );
    mocks.prismaMembershipFindFirst.mockResolvedValue(null);
    mocks.productsList.mockResolvedValue({
      data: [
        {
          id: "prod_hobby",
          metadata: { formbricks_plan: "hobby" },
          active: true,
          default_price: null,
        },
      ],
    });
    mocks.productsRetrieve.mockImplementation(async (productId: string) => ({
      id: productId,
      active: true,
      metadata:
        productId === "prod_hobby"
          ? { formbricks_plan: "hobby" }
          : productId === "prod_pro"
            ? { formbricks_plan: "pro" }
            : productId === "prod_scale"
              ? { formbricks_plan: "scale" }
              : {},
    }));
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_hobby_monthly",
          active: true,
          currency: "usd",
          unit_amount: 0,
          metadata: {
            formbricks_plan: "hobby",
            formbricks_price_kind: "base",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "licensed", interval: "month" },
          product: { id: "prod_hobby", active: true, metadata: { formbricks_plan: "hobby" } },
        },
        {
          id: "price_pro_monthly",
          active: true,
          currency: "usd",
          unit_amount: 8900,
          metadata: {
            formbricks_plan: "pro",
            formbricks_price_kind: "base",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "licensed", interval: "month" },
          product: { id: "prod_pro", active: true, metadata: { formbricks_plan: "pro" } },
        },
        {
          id: "price_pro_yearly",
          active: true,
          currency: "usd",
          unit_amount: 89000,
          metadata: {
            formbricks_plan: "pro",
            formbricks_price_kind: "base",
            formbricks_interval: "yearly",
          },
          recurring: { usage_type: "licensed", interval: "year" },
          product: { id: "prod_pro", active: true, metadata: { formbricks_plan: "pro" } },
        },
        {
          id: "price_pro_responses",
          active: true,
          currency: "usd",
          unit_amount: 0,
          metadata: {
            formbricks_plan: "pro",
            formbricks_price_kind: "responses",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "metered", interval: "month" },
          product: { id: "prod_pro", active: true, metadata: { formbricks_plan: "pro" } },
        },
        {
          id: "price_scale_monthly",
          active: true,
          currency: "usd",
          unit_amount: 39000,
          metadata: {
            formbricks_plan: "scale",
            formbricks_price_kind: "base",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "licensed", interval: "month" },
          product: { id: "prod_scale", active: true, metadata: { formbricks_plan: "scale" } },
        },
        {
          id: "price_scale_yearly",
          active: true,
          currency: "usd",
          unit_amount: 390000,
          metadata: {
            formbricks_plan: "scale",
            formbricks_price_kind: "base",
            formbricks_interval: "yearly",
          },
          recurring: { usage_type: "licensed", interval: "year" },
          product: { id: "prod_scale", active: true, metadata: { formbricks_plan: "scale" } },
        },
        {
          id: "price_scale_responses",
          active: true,
          currency: "usd",
          unit_amount: 0,
          metadata: {
            formbricks_plan: "scale",
            formbricks_price_kind: "responses",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "metered", interval: "month" },
          product: { id: "prod_scale", active: true, metadata: { formbricks_plan: "scale" } },
        },
      ],
      has_more: false,
    });
    mocks.pricesRetrieve.mockImplementation(async (priceId: string) => {
      const pricesById: Record<string, unknown> = {
        price_hobby_monthly: {
          id: "price_hobby_monthly",
          active: true,
          currency: "usd",
          unit_amount: 0,
          metadata: {
            formbricks_plan: "hobby",
            formbricks_price_kind: "base",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "licensed", interval: "month" },
          product: { id: "prod_hobby", active: true, metadata: { formbricks_plan: "hobby" } },
        },
        price_pro_monthly: {
          id: "price_pro_monthly",
          active: true,
          currency: "usd",
          unit_amount: 8900,
          metadata: {
            formbricks_plan: "pro",
            formbricks_price_kind: "base",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "licensed", interval: "month" },
          product: { id: "prod_pro", active: true, metadata: { formbricks_plan: "pro" } },
        },
        price_pro_responses: {
          id: "price_pro_responses",
          active: true,
          currency: "usd",
          unit_amount: 0,
          metadata: {
            formbricks_plan: "pro",
            formbricks_price_kind: "responses",
            formbricks_interval: "monthly",
          },
          recurring: { usage_type: "metered", interval: "month" },
          product: { id: "prod_pro", active: true, metadata: { formbricks_plan: "pro" } },
        },
      };
      const price = pricesById[priceId];
      if (!price) {
        throw new Error(`Unknown mocked price ${priceId}`);
      }
      return price;
    });
    mocks.entitlementsList.mockResolvedValue({ data: [], has_more: false });
    mocks.prismaOrganizationBillingCreate.mockResolvedValue({
      stripeCustomerId: null,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: null,
    });
    mocks.subscriptionSchedulesCreate.mockResolvedValue({
      id: "sched_new",
      current_phase: { start_date: 1739923200, end_date: 1742515200 },
      phases: [{ start_date: 1739923200, end_date: 1742515200, items: [] }],
    });
    mocks.subscriptionSchedulesRetrieve.mockResolvedValue({
      id: "sched_existing",
      current_phase: { start_date: 1739923200, end_date: 1742515200 },
      phases: [{ start_date: 1739923200, end_date: 1742515200, items: [] }],
    });
    mocks.subscriptionSchedulesUpdate.mockImplementation(async (_scheduleId, input) => ({
      id: "sched_updated",
      current_phase: { start_date: 1739923200, end_date: 1742515200 },
      phases: input.phases,
    }));
    mocks.subscriptionSchedulesRelease.mockResolvedValue({});
    mocks.subscriptionsUpdate.mockResolvedValue({});
    // Default: no card at the customer level either. The payment-method check falls back to the
    // customer default when the subscription has none, so it must always resolve to a customer.
    // Implementation (not a fixed value) so the credit balance read-back sees live movement.
    mocks.customersRetrieve.mockImplementation(async () => ({
      id: "cus_1",
      deleted: false,
      invoice_settings: { default_payment_method: null },
      currency: "usd",
      balance: stripeCustomerBalanceCents,
    }));
  });

  test("ensureStripeCustomerForOrganization returns null when org does not exist", async () => {
    mocks.prismaOrganizationFindUnique.mockResolvedValue(null);

    const result = await ensureStripeCustomerForOrganization("org_missing");

    expect(result).toEqual({ customerId: null });
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  test("ensureStripeCustomerForOrganization always creates a fresh Stripe customer", async () => {
    mocks.prismaOrganizationFindUnique.mockResolvedValue({
      id: "org_1",
      name: "Org 1",
    });
    mocks.prismaMembershipFindFirst.mockResolvedValue({
      user: { email: "owner@example.com", name: "Owner Name" },
    });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });

    const result = await ensureStripeCustomerForOrganization("org_1");

    expect(result).toEqual({ customerId: "cus_new" });
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      {
        name: "Owner Name",
        email: "owner@example.com",
        metadata: { organizationId: "org_1", organizationName: "Org 1" },
      },
      { idempotencyKey: "ensure-customer-org_1" }
    );
    expect(mocks.prismaOrganizationBillingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org_1" },
        create: expect.objectContaining({ stripeCustomerId: "cus_new" }),
        update: expect.objectContaining({ stripeCustomerId: "cus_new" }),
      })
    );
  });

  test("ensureStripeCustomerForOrganization creates and stores a Stripe customer", async () => {
    mocks.prismaOrganizationFindUnique.mockResolvedValue({
      id: "org_1",
      name: "Org 1",
    });
    mocks.prismaMembershipFindFirst.mockResolvedValue({
      user: { email: "owner@example.com", name: "Owner Name" },
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: null,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: null,
    });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });

    const result = await ensureStripeCustomerForOrganization("org_1");

    expect(result).toEqual({ customerId: "cus_new" });
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      {
        name: "Owner Name",
        email: "owner@example.com",
        metadata: { organizationId: "org_1", organizationName: "Org 1" },
      },
      { idempotencyKey: "ensure-customer-org_1" }
    );
    expect(mocks.prismaOrganizationBillingUpsert).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      create: expect.objectContaining({
        organizationId: "org_1",
        stripeCustomerId: "cus_new",
      }),
      update: expect.objectContaining({
        stripeCustomerId: "cus_new",
        stripe: expect.objectContaining({
          lastSyncedAt: expect.any(String),
        }),
      }),
    });
    expect(mocks.cacheDel).toHaveBeenCalledWith(["billing-cache-key"]);
  });

  test("syncOrganizationBillingFromStripe returns billing unchanged when customer is missing", async () => {
    const usageCycleAnchor = new Date("2026-04-08T07:19:10.425Z");
    const billing = {
      stripeCustomerId: null,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor,
    };
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      ...billing,
      usageCycleAnchor,
      stripe: null,
    });

    const result = await syncOrganizationBillingFromStripe("org_1");

    expect(result).toEqual(billing);
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
  });

  test("syncOrganizationBillingFromStripe stores hobby plan when customer has no active subscription", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: { lastSyncedEventId: null },
    });
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.entitlementsList.mockResolvedValue({ data: [], has_more: false });

    const result = await syncOrganizationBillingFromStripe("org_1");

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: expect.objectContaining({
        stripeCustomerId: "cus_1",
        stripe: expect.objectContaining({
          plan: "hobby",
          subscriptionStatus: null,
          subscriptionId: null,
          features: [],
          lastSyncedAt: expect.any(String),
        }),
      }),
    });
    expect(result?.stripe?.plan).toBe("hobby");
    expect(result?.stripe?.subscriptionStatus).toBeNull();
  });

  test("syncOrganizationBillingFromStripe clears a prior payment-failure banner when the plan changes", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        // Snapshot says "pro"; Stripe (no subscription) resolves to "hobby" → plan changed.
        plan: "pro",
        lastSyncedEventId: null,
        paymentAttemptError: {
          type: "failed_invoice",
          paymentIntentId: "pi_1",
          message: "x",
          createdAt: "t",
        },
      },
    });
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.entitlementsList.mockResolvedValue({ data: [], has_more: false });

    await syncOrganizationBillingFromStripe("org_1");

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: expect.objectContaining({
        stripe: expect.objectContaining({ paymentAttemptError: null }),
      }),
    });
  });

  test("syncOrganizationBillingFromStripe clears a prior payment-failure banner on an event-driven sync", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        plan: "hobby",
        lastSyncedEventId: null,
        paymentAttemptError: {
          type: "failed_invoice",
          paymentIntentId: "pi_1",
          message: "x",
          createdAt: "t",
        },
      },
    });
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.entitlementsList.mockResolvedValue({ data: [], has_more: false });

    await syncOrganizationBillingFromStripe("org_1", { id: "evt_1", created: 1739923200 });

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: expect.objectContaining({
        stripe: expect.objectContaining({ paymentAttemptError: null }),
      }),
    });
  });

  test("syncOrganizationBillingFromStripe preserves the banner on a read-through sync with no plan change", async () => {
    const paymentAttemptError = {
      type: "failed_invoice",
      paymentIntentId: "pi_1",
      message: "x",
      createdAt: "t",
    };
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      // No subscription resolves back to "hobby", so this staleness-triggered sync
      // observes no settlement and must not dismiss the unresolved failure.
      stripe: { plan: "hobby", lastSyncedEventId: null, paymentAttemptError },
    });
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.entitlementsList.mockResolvedValue({ data: [], has_more: false });

    await syncOrganizationBillingFromStripe("org_1");

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: expect.objectContaining({
        stripe: expect.objectContaining({ paymentAttemptError }),
      }),
    });
  });

  test("setOrganizationPaymentAttemptError stores the marker and invalidates the cache", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: { plan: "pro" },
    });

    const error = { type: "requires_action" as const, paymentIntentId: "pi_1", message: "x", createdAt: "t" };
    await setOrganizationPaymentAttemptError("org_1", error);

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      // Preserves the rest of the snapshot (plan) while setting the marker.
      data: {
        stripe: expect.objectContaining({ plan: "pro", paymentAttemptError: error }),
      },
    });
    expect(mocks.cacheDel).toHaveBeenCalled();
  });

  test("setOrganizationPaymentAttemptError with null clears the marker", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: { plan: "pro", paymentAttemptError: { type: "failed_invoice" } },
    });

    await setOrganizationPaymentAttemptError("org_1", null);

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: { stripe: expect.objectContaining({ paymentAttemptError: null }) },
    });
  });

  test("syncOrganizationBillingFromStripe ignores duplicate webhook events", async () => {
    const billing = {
      stripeCustomerId: "cus_1",
      stripe: {
        lastSyncedEventId: "evt_1",
        lastStripeEventCreatedAt: new Date("2026-02-19T00:00:00.000Z").toISOString(),
      },
    };
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      ...billing,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
    });

    const result = await syncOrganizationBillingFromStripe("org_1", { id: "evt_1", created: 1739923200 });

    expect(result).toEqual(
      expect.objectContaining({
        stripeCustomerId: billing.stripeCustomerId,
        stripe: billing.stripe,
      })
    );
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
  });

  test("syncOrganizationBillingFromStripe ignores older webhook events", async () => {
    const billing = {
      stripeCustomerId: "cus_1",
      stripe: {
        lastStripeEventCreatedAt: "2026-02-20T00:00:00.000Z",
      },
    };
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      ...billing,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: billing.stripe,
    });

    const result = await syncOrganizationBillingFromStripe("org_1", { id: "evt_old", created: 1739923200 });

    expect(result).toEqual(
      expect.objectContaining({
        stripeCustomerId: billing.stripeCustomerId,
        stripe: billing.stripe,
      })
    );
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
  });

  test("syncOrganizationBillingFromStripe stores normalized stripe snapshot", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: { lastSyncedEventId: null },
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" } },
                  recurring: { usage_type: "licensed", interval: "year" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.checkoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });
    mocks.entitlementsList.mockResolvedValue({
      data: [
        { id: "ent_0", lookup_key: "workspace-limit-5" },
        { id: "ent_00", lookup_key: "responses-included-2000" },
        { id: "ent_1", lookup_key: "custom-links-in-surveys" },
        { id: "ent_2", lookup_key: "custom-links-in-surveys" },
        { id: "ent_3", lookup_key: null },
      ],
      has_more: false,
    });

    const result = await syncOrganizationBillingFromStripe("org_1", { id: "evt_new", created: 1739923300 });

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: {
        stripeCustomerId: "cus_1",
        limits: {
          workspaces: 5,
          monthly: {
            responses: 2000,
          },
        },
        stripe: expect.objectContaining({
          plan: "pro",
          subscriptionId: "sub_1",
          features: ["workspace-limit-5", "responses-included-2000", "custom-links-in-surveys"],
          lastSyncedEventId: "evt_new",
          lastStripeEventCreatedAt: expect.any(String),
          lastSyncedAt: expect.any(String),
        }),
        usageCycleAnchor: expect.any(Date),
      },
    });
    expect(result?.stripe?.plan).toBe("pro");
    expect(result?.stripe?.features).toEqual([
      "workspace-limit-5",
      "responses-included-2000",
      "custom-links-in-surveys",
    ]);
    expect(mocks.cacheDel).toHaveBeenCalledWith(["billing-cache-key"]);
  });

  test("createPaidPlanCheckoutSession rejects mixed-interval yearly checkout", async () => {
    await expect(
      createPaidPlanCheckoutSession({
        organizationId: "org_1",
        customerId: "cus_1",
        plan: "pro",
        interval: "yearly",
      })
    ).rejects.toThrow("mixed_interval_checkout_unsupported");

    expect(mocks.checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan persists pending downgrade snapshot immediately", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
              {
                id: "si_pro_responses",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_responses",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "responses",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "metered", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "pro",
        interval: "monthly",
        hasPaymentMethod: true,
      },
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "hobby",
      targetInterval: "monthly",
    });

    expect(result).toEqual({
      mode: "scheduled",
      pendingChange: {
        type: "plan_change",
        targetPlan: "hobby",
        targetInterval: "monthly",
        effectiveAt: new Date(1742515200 * 1000).toISOString(),
      },
      clientSecret: null,
      requiresAction: false,
    });
    expect(mocks.subscriptionSchedulesCreate).toHaveBeenCalledWith({
      from_subscription: "sub_1",
    });
    expect(mocks.subscriptionSchedulesUpdate).toHaveBeenCalledWith(
      "sched_new",
      expect.objectContaining({
        metadata: {
          organizationId: "org_1",
        },
        phases: [
          {
            start_date: 1739923200,
            end_date: 1742515200,
            items: [{ price: "price_pro_monthly", quantity: 1 }, { price: "price_pro_responses" }],
          },
          {
            start_date: 1742515200,
            items: [{ price: "price_hobby_monthly", quantity: 1 }],
            metadata: {
              organizationId: "org_1",
              targetPlan: "hobby",
              targetInterval: "monthly",
            },
          },
        ],
      })
    );
    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: {
        stripe: expect.objectContaining({
          subscriptionId: "sub_1",
          plan: "pro",
          interval: "monthly",
          hasPaymentMethod: true,
          pendingChange: {
            type: "plan_change",
            targetPlan: "hobby",
            targetInterval: "monthly",
            effectiveAt: new Date(1742515200 * 1000).toISOString(),
          },
          lastSyncedAt: expect.any(String),
        }),
      },
    });
    expect(mocks.cacheDel).toHaveBeenCalledWith(["billing-cache-key"]);
  });

  test("switchOrganizationToCloudPlan switches a no-card trial to Hobby immediately on downgrade instead of scheduling", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          default_payment_method: null,
          trial_end: 1742515200,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    // No card on the subscription and none on the customer either.
    mocks.customersRetrieve.mockResolvedValue({
      id: "cus_1",
      deleted: false,
      invoice_settings: { default_payment_method: null },
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: false,
      },
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "hobby",
      targetInterval: "monthly",
    });

    expect(result).toEqual({
      mode: "immediate",
      pendingChange: null,
      clientSecret: null,
      requiresAction: false,
    });
    // The trial ends now and the subscription moves straight to the free Hobby items — no schedule,
    // no cancel_at_period_end, no charge.
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith("sub_trial", {
      items: [
        { id: "si_pro_base", deleted: true },
        { price: "price_hobby_monthly", quantity: 1 },
      ],
      trial_end: "now",
      proration_behavior: "none",
      trial_settings: { end_behavior: { missing_payment_method: "create_invoice" } },
    });
    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalledWith("sub_trial", {
      cancel_at_period_end: true,
    });
    expect(mocks.subscriptionSchedulesCreate).not.toHaveBeenCalled();
    expect(mocks.subscriptionSchedulesUpdate).not.toHaveBeenCalled();
    // Any prior pending downgrade snapshot is nulled — the switch is applied immediately.
    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: {
        stripe: expect.objectContaining({
          pendingChange: null,
        }),
      },
    });
  });

  test("switchOrganizationToCloudPlan switches a CARD-BACKED trial to Hobby immediately on downgrade instead of scheduling", async () => {
    // A card-backed trial opting back to Hobby also switches immediately to the free Hobby plan —
    // never build a schedule whose phase 1 is a billable Pro phase (charging the trial early), and
    // never leave the user on the paid trial they explicitly left.
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          // Card IS on the subscription — previously this fell through to the scheduled path.
          default_payment_method: "pm_sub",
          trial_end: 1742515200,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: true,
      },
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "hobby",
      targetInterval: "monthly",
    });

    expect(result.mode).toBe("immediate");
    expect(result.pendingChange).toBeNull();
    // Switched to the free Hobby items now, NOT scheduled or cancelled at period end.
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith("sub_trial", {
      items: [
        { id: "si_pro_base", deleted: true },
        { price: "price_hobby_monthly", quantity: 1 },
      ],
      trial_end: "now",
      proration_behavior: "none",
      trial_settings: { end_behavior: { missing_payment_method: "create_invoice" } },
    });
    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalledWith("sub_trial", {
      cancel_at_period_end: true,
    });
    expect(mocks.subscriptionSchedulesCreate).not.toHaveBeenCalled();
    expect(mocks.subscriptionSchedulesUpdate).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan rejects a paid switch from a no-card trial", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          default_payment_method: null,
          trial_end: 1742515200,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.customersRetrieve.mockResolvedValue({
      id: "cus_1",
      deleted: false,
      invoice_settings: { default_payment_method: null },
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: false,
      },
    });

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "scale",
        targetInterval: "monthly",
      })
    ).rejects.toThrow("payment_method_required");

    // No billable conversion is attempted.
    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalled();
    expect(mocks.subscriptionSchedulesCreate).not.toHaveBeenCalled();
    expect(mocks.subscriptionSchedulesUpdate).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan releases a stray schedule before switching a no-card trial to Hobby on downgrade", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          default_payment_method: null,
          trial_end: 1742515200,
          schedule: "sched_trial",
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.customersRetrieve.mockResolvedValue({
      id: "cus_1",
      deleted: false,
      invoice_settings: { default_payment_method: null },
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: false,
      },
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "hobby",
      targetInterval: "monthly",
    });

    expect(result.mode).toBe("immediate");
    // The stray schedule (which would otherwise rebuild the trial into a billable Pro phase) is
    // released first, then the trial ends and moves straight to the free Hobby items.
    expect(mocks.subscriptionSchedulesRelease).toHaveBeenCalledWith("sched_trial", {
      preserve_cancel_date: false,
    });
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith("sub_trial", {
      items: [
        { id: "si_pro_base", deleted: true },
        { price: "price_hobby_monthly", quantity: 1 },
      ],
      trial_end: "now",
      proration_behavior: "none",
      trial_settings: { end_behavior: { missing_payment_method: "create_invoice" } },
    });
    expect(mocks.subscriptionSchedulesCreate).not.toHaveBeenCalled();
    expect(mocks.subscriptionSchedulesUpdate).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan allows a paid switch from a trial when the card is only on the customer", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          // No card on the subscription itself...
          default_payment_method: null,
          trial_end: 1742515200,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    // ...but a card is saved at the customer level, so the paid switch must be allowed through.
    mocks.customersRetrieve.mockResolvedValue({
      id: "cus_1",
      deleted: false,
      invoice_settings: { default_payment_method: "pm_customer" },
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: false,
      },
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "scale",
      targetInterval: "monthly",
    });

    // Proceeds through the normal paid path instead of being rejected or cancelled.
    expect(result.mode).toBe("immediate");
    // Single update: ends the trial AND switches items at once, so the card is invoiced exactly once
    // for the target plan (a split update would double-invoice — old plan then new plan).
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_trial",
      expect.objectContaining({
        trial_end: "now",
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      })
    );
    // Exactly one items/trial update on the subscription (no separate trial_end-only update).
    const trialEndUpdateCalls = mocks.subscriptionsUpdate.mock.calls.filter(
      ([id]: [string]) => id === "sub_trial"
    );
    expect(trialEndUpdateCalls).toHaveLength(1);
    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalledWith("sub_trial", {
      cancel_at_period_end: true,
    });
    // A tier change out of a trial (Pro trial -> Scale) is a full upgrade: no unused-trial credit.
    expect(mocks.customersCreateBalanceTransaction).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan converts a card-backed trial to the same paid plan instead of treating it as a no-op", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          // Card is on the subscription itself, so the paid conversion is allowed immediately.
          default_payment_method: "pm_sub",
          trial_end: 1742515200,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: true,
      },
    });

    // Same plan + interval as the one being trialed: pre-change this returned a no-op; a card-backed
    // trial must instead convert to paid and charge now.
    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
    });

    expect(result.mode).toBe("immediate");
    // Single update ends the trial and applies the target plan in one invoice.
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_trial",
      expect.objectContaining({
        trial_end: "now",
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      })
    );
    const trialUpdateCalls = mocks.subscriptionsUpdate.mock.calls.filter(
      ([id]: [string]) => id === "sub_trial"
    );
    expect(trialUpdateCalls).toHaveLength(1);
  });

  test("switchOrganizationToCloudPlan clears a pending hobby downgrade when converting a card-backed trial to paid", async () => {
    // A trial carrying a pending downgrade tracked via cancel_at_period_end (no schedule). Adding a
    // card and upgrading to paid Pro must supersede that pending downgrade, otherwise the Hobby card
    // keeps showing a stale "Scheduled" badge after the upgrade.
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          billing_cycle_anchor: 1739923200,
          // The pending hobby downgrade is tracked here, not via a schedule.
          cancel_at_period_end: true,
          default_payment_method: "pm_sub",
          trial_end: 1742515200,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: true,
        pendingChange: {
          type: "plan_change",
          targetPlan: "hobby",
          targetInterval: "monthly",
          effectiveAt: "2026-08-11T00:00:00.000Z",
        },
      },
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
    });

    expect(result.mode).toBe("immediate");
    expect(result.pendingChange).toBeNull();
    // Ends the trial and switches items in one update...
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_trial",
      expect.objectContaining({ trial_end: "now", payment_behavior: "error_if_incomplete" })
    );
    // ...clears the cancel_at_period_end that backed the pending hobby downgrade...
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith("sub_trial", { cancel_at_period_end: false });
    // ...and nulls the persisted pending-change snapshot so no stale "Scheduled" badge lingers.
    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripe: expect.objectContaining({ pendingChange: null }),
        }),
      })
    );
  });

  // Shared fixture: a card-backed Pro trial with `remaining` days left on the trial.
  const setupProTrialForCredit = (remainingDays: number) => {
    const trialEnd = Math.floor(Date.now() / 1000) + remainingDays * 86_400;
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_trial",
          status: "trialing",
          currency: "usd",
          billing_cycle_anchor: trialEnd,
          cancel_at_period_end: false,
          default_payment_method: "pm_sub",
          trial_end: trialEnd,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: trialEnd,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_trial",
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        hasPaymentMethod: true,
      },
    });
    mocks.invoicesCreatePreview.mockResolvedValue({ amount_due: 8900, currency: "usd" });
  };

  test("switchOrganizationToCloudPlan credits unused trial days when a card-backed Pro trial converts to Pro", async () => {
    setupProTrialForCredit(14); // 14 days left -> credit = round(8900 * 14 / 30) = 4153

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
      applyTrialCredit: true,
    });

    expect(result.mode).toBe("immediate");
    // Credit applied once, negative (a credit), with a per-trial idempotency key.
    expect(mocks.customersCreateBalanceTransaction).toHaveBeenCalledWith(
      "cus_1",
      expect.objectContaining({ amount: -4153, currency: "usd" }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("trial-credit-sub_trial") })
    );
    // The conversion still ran.
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_trial",
      expect.objectContaining({ trial_end: "now", payment_behavior: "error_if_incomplete" })
    );
    // No reversal (positive) balance transaction on the success path.
    const positive = mocks.customersCreateBalanceTransaction.mock.calls.filter(
      ([, args]: [string, { amount: number }]) => args.amount > 0
    );
    expect(positive).toHaveLength(0);
  });

  test("switchOrganizationToCloudPlan reverses the unused-trial credit when the conversion charge fails", async () => {
    setupProTrialForCredit(14);
    mocks.subscriptionsUpdate.mockRejectedValueOnce(new Error("card_declined"));

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "pro",
        targetInterval: "monthly",
        applyTrialCredit: true,
      })
    ).rejects.toThrow();

    const calls = mocks.customersCreateBalanceTransaction.mock.calls;
    // Applied -4153, then reversed +4153 -> net zero, so no credit can strand on the balance.
    expect(calls.some(([, a]: [string, { amount: number }]) => a.amount === -4153)).toBe(true);
    expect(calls.some(([, a]: [string, { amount: number }]) => a.amount === 4153)).toBe(true);

    // The reversal MUST carry its own idempotency key (distinct from the credit's) so a retried
    // conversion can't post a second +credit against an already-reversed pair and net-debit the
    // customer. The credit key is `trial-credit-...`; the reversal is `trial-credit-reversal-...`.
    const reversalCall = calls.find(([, a]: [string, { amount: number }]) => a.amount === 4153);
    expect(reversalCall?.[2]).toEqual(
      expect.objectContaining({ idempotencyKey: expect.stringContaining("trial-credit-reversal-sub_trial") })
    );
  });

  test("switchOrganizationToCloudPlan does NOT credit a card-on-file Pro-trial upgrade (applyTrialCredit omitted)", async () => {
    setupProTrialForCredit(14);

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
      // no applyTrialCredit -> "Upgrade now" with a card on file is billed the full price.
    });

    expect(result.mode).toBe("immediate");
    // Still converts (ends the trial, charges now)...
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_trial",
      expect.objectContaining({ trial_end: "now", payment_behavior: "error_if_incomplete" })
    );
    // ...but applies no unused-trial credit.
    expect(mocks.customersCreateBalanceTransaction).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan refuses to charge when the unused-trial credit does not land on the balance", async () => {
    setupProTrialForCredit(14);
    // Stripe replaying an idempotency key from an earlier (already-reversed) attempt returns the
    // original transaction WITHOUT executing it, so the balance never moves. Charging anyway would
    // bill the full price behind a modal that quoted the discounted one.
    mocks.customersCreateBalanceTransaction.mockResolvedValue({ id: "cbtxn_replayed", amount: -4153 });

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "pro",
        targetInterval: "monthly",
        applyTrialCredit: true,
      })
    ).rejects.toThrow("trial_credit_unavailable");

    // The conversion must not have run: the trial is intact and nothing was charged.
    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalledWith(
      "sub_trial",
      expect.objectContaining({ trial_end: "now" })
    );
  });

  test("switchOrganizationToCloudPlan posts the credit in the SUBSCRIPTION's currency, not the catalog price's", async () => {
    setupProTrialForCredit(14);
    // Customer balances are per-currency and the invoice is in the subscription's currency, so a
    // credit posted in the catalog price's default currency would never be applied to the invoice —
    // full charge AND a stranded credit.
    const trialEnd = Math.floor(Date.now() / 1000) + 14 * 86_400;
    const existing = await mocks.subscriptionsList();
    mocks.subscriptionsList.mockResolvedValue({
      data: [{ ...existing.data[0], currency: "eur", trial_end: trialEnd }],
    });
    mocks.customersRetrieve.mockImplementation(async () => ({
      id: "cus_1",
      deleted: false,
      invoice_settings: { default_payment_method: "pm_sub" },
      currency: "eur",
      balance: stripeCustomerBalanceCents,
    }));

    await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
      applyTrialCredit: true,
    });

    expect(mocks.customersCreateBalanceTransaction).toHaveBeenCalledWith(
      "cus_1",
      expect.objectContaining({ currency: "eur" }),
      expect.anything()
    );
  });

  test("previewImmediateUpgradeCharge nets the credit off the INVOICE total (tax + usage), not the list price", async () => {
    setupProTrialForCredit(14);
    // Stripe's preview is the invoice total: $89 base + $16.91 VAT. The credit is computed from the
    // tax-exclusive list price (round(8900 * 14 / 30) = 4153) — the same basis applyUnusedTrialCredit
    // uses — and netted off that total, so the quoted amount matches what the card is actually billed.
    // grossAmountDue stays the LIST price, which is what the modal calls "the {plan} price".
    mocks.invoicesCreatePreview.mockResolvedValue({ amount_due: 10_591, currency: "usd" });

    const preview = await previewImmediateUpgradeCharge({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
      applyTrialCredit: true,
    });

    expect(preview).toEqual({
      amountDue: 10_591 - 4153,
      currency: "usd",
      grossAmountDue: 8900,
      trialCreditApplied: 4153,
    });
  });

  test("previewImmediateUpgradeCharge falls back to the list price when Stripe cannot preview the invoice", async () => {
    setupProTrialForCredit(14);
    // A preview can fail on usage-based line items; the modal still needs a number, so it falls back
    // to the catalog list price (the copy carries a taxes-at-payment caveat for exactly this case).
    mocks.invoicesCreatePreview.mockRejectedValue(new Error("cannot preview metered price"));

    const preview = await previewImmediateUpgradeCharge({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
      applyTrialCredit: true,
    });

    expect(preview).toEqual({
      amountDue: 8900 - 4153,
      currency: "usd",
      grossAmountDue: 8900,
      trialCreditApplied: 4153,
    });
  });

  test("previewImmediateUpgradeCharge does NOT send trial_end for a non-trialing upgrade", async () => {
    // trial_end re-anchors the billing cycle, so sending it here would preview a full fresh period
    // while the real update (which sends no trial_end) charges a mid-cycle proration — over-stating
    // the amount on every ordinary paid upgrade.
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_active",
          status: "active",
          currency: "usd",
          billing_cycle_anchor: 1_739_923_200,
          cancel_at_period_end: false,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1_742_515_200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.invoicesCreatePreview.mockResolvedValue({ amount_due: 4500, currency: "usd" });

    const preview = await previewImmediateUpgradeCharge({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "scale",
      targetInterval: "monthly",
    });

    expect(preview).toEqual({
      amountDue: 4500,
      currency: "usd",
      grossAmountDue: 4500,
      trialCreditApplied: 0,
    });
    const [previewArgs] = mocks.invoicesCreatePreview.mock.calls[0];
    expect(previewArgs.subscription_details).not.toHaveProperty("trial_end");
  });

  test("previewImmediateUpgradeCharge sends trial_end for a trialing subscription (the cycle really does reset)", async () => {
    setupProTrialForCredit(14);

    await previewImmediateUpgradeCharge({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "scale",
      targetInterval: "monthly",
    });

    const [previewArgs] = mocks.invoicesCreatePreview.mock.calls[0];
    expect(previewArgs.subscription_details).toMatchObject({ trial_end: "now" });
  });

  test("the unused-trial credit idempotency key includes the amount so a tapered retry cannot collide", async () => {
    // Same key + different amount is a hard Stripe error that would block the conversion outright;
    // the amount is part of the key so a retry on a later day gets a fresh one. A same-day
    // double-submit computes the same amount, so it still deduplicates.
    setupProTrialForCredit(14);
    await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
      applyTrialCredit: true,
    });

    const [, , options] = mocks.customersCreateBalanceTransaction.mock.calls[0];
    expect(options.idempotencyKey).toContain("-4153");
  });

  test("switchOrganizationToCloudPlan uses pending_if_incomplete for immediate upgrades so the plan is granted only once paid", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
              {
                id: "si_pro_responses",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_responses",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "responses",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "metered", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "pro",
        interval: "monthly",
        hasPaymentMethod: true,
      },
    });

    await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "scale",
      targetInterval: "monthly",
    });

    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
      })
    );
  });

  test("switchOrganizationToCloudPlan updates an existing schedule in place", async () => {
    mocks.getCloudPlanFromProduct.mockImplementation((product: { id?: string } | string) => {
      const productId = typeof product === "string" ? product : product.id;
      return productId === "prod_scale" ? "scale" : "pro";
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: "sched_existing",
          items: {
            data: [
              {
                id: "si_scale_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_scale_monthly",
                  metadata: {
                    formbricks_plan: "scale",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_scale", metadata: { formbricks_plan: "scale" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
              {
                id: "si_scale_responses",
                current_period_end: 1742515200,
                price: {
                  id: "price_scale_responses",
                  metadata: {
                    formbricks_plan: "scale",
                    formbricks_price_kind: "responses",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_scale", metadata: { formbricks_plan: "scale" }, active: true },
                  recurring: { usage_type: "metered", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 5,
        monthly: {
          responses: 5000,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "scale",
        interval: "monthly",
        hasPaymentMethod: true,
        pendingChange: {
          type: "plan_change",
          targetPlan: "hobby",
          targetInterval: "monthly",
          effectiveAt: new Date(1742515200 * 1000).toISOString(),
        },
      },
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
    });

    expect(result.mode).toBe("scheduled");
    expect(mocks.subscriptionSchedulesRelease).not.toHaveBeenCalledWith("sched_existing", {
      preserve_cancel_date: false,
    });
    expect(mocks.subscriptionSchedulesCreate).not.toHaveBeenCalled();
    expect(mocks.subscriptionSchedulesRetrieve).toHaveBeenCalledWith("sched_existing");
    expect(mocks.subscriptionSchedulesUpdate).toHaveBeenCalledWith(
      "sched_existing",
      expect.objectContaining({
        metadata: {
          organizationId: "org_1",
        },
      })
    );
  });

  test("switchOrganizationToCloudPlan returns early for the current selection without disturbing pending state", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: "sched_existing",
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });

    const result = await switchOrganizationToCloudPlan({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
    });

    expect(result).toEqual({
      mode: "immediate",
      pendingChange: null,
      clientSecret: null,
      requiresAction: false,
    });
    expect(mocks.subscriptionSchedulesRelease).not.toHaveBeenCalled();
    expect(mocks.subscriptionSchedulesCreate).not.toHaveBeenCalled();
    expect(mocks.prismaOrganizationBillingUpdate).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan releases a newly created schedule when update fails", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
              {
                id: "si_pro_responses",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_responses",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "responses",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "metered", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "pro",
        interval: "monthly",
        hasPaymentMethod: true,
      },
    });
    mocks.subscriptionSchedulesUpdate.mockRejectedValue(new Error("stripe update failed"));

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "hobby",
        targetInterval: "monthly",
      })
    ).rejects.toThrow("stripe update failed");

    expect(mocks.subscriptionSchedulesRelease).toHaveBeenCalledWith("sched_new", {
      preserve_cancel_date: false,
    });
  });

  test("switchOrganizationToCloudPlan preserves an existing schedule when replacement fails", async () => {
    mocks.getCloudPlanFromProduct.mockImplementation((product: { id?: string } | string) => {
      const productId = typeof product === "string" ? product : product.id;
      return productId === "prod_scale" ? "scale" : "pro";
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: "sched_existing",
          items: {
            data: [
              {
                id: "si_scale_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_scale_monthly",
                  metadata: {
                    formbricks_plan: "scale",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_scale", metadata: { formbricks_plan: "scale" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
              {
                id: "si_scale_responses",
                current_period_end: 1742515200,
                price: {
                  id: "price_scale_responses",
                  metadata: {
                    formbricks_plan: "scale",
                    formbricks_price_kind: "responses",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_scale", metadata: { formbricks_plan: "scale" }, active: true },
                  recurring: { usage_type: "metered", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 5,
        monthly: {
          responses: 5000,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "scale",
        interval: "monthly",
        hasPaymentMethod: true,
        pendingChange: {
          type: "plan_change",
          targetPlan: "hobby",
          targetInterval: "monthly",
          effectiveAt: new Date(1742515200 * 1000).toISOString(),
        },
      },
    });
    mocks.subscriptionSchedulesUpdate.mockRejectedValue(new Error("stripe update failed"));

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "pro",
        targetInterval: "monthly",
      })
    ).rejects.toThrow("stripe update failed");

    expect(mocks.subscriptionSchedulesRetrieve).toHaveBeenCalledWith("sched_existing");
    expect(mocks.subscriptionSchedulesRelease).not.toHaveBeenCalledWith("sched_existing", {
      preserve_cancel_date: false,
    });
    expect(mocks.subscriptionSchedulesCreate).not.toHaveBeenCalled();
  });

  test("switchOrganizationToCloudPlan restores cancel_at_period_end when scheduling fails", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: true,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
              {
                id: "si_pro_responses",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_responses",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "responses",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "metered", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "pro",
        interval: "monthly",
        hasPaymentMethod: true,
      },
    });
    mocks.subscriptionSchedulesUpdate.mockRejectedValue(new Error("stripe update failed"));

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "hobby",
        targetInterval: "monthly",
      })
    ).rejects.toThrow("stripe update failed");

    expect(mocks.subscriptionsUpdate).toHaveBeenNthCalledWith(1, "sub_1", {
      cancel_at_period_end: false,
    });
    expect(mocks.subscriptionSchedulesRelease).toHaveBeenCalledWith("sched_new", {
      preserve_cancel_date: false,
    });
    expect(mocks.subscriptionsUpdate).toHaveBeenNthCalledWith(2, "sub_1", {
      cancel_at_period_end: true,
    });
  });

  test("switchOrganizationToCloudPlan preserves an existing schedule when an immediate upgrade fails", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: "sched_existing",
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
              {
                id: "si_pro_responses",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_responses",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "responses",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "metered", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.subscriptionsUpdate.mockRejectedValue(new Error("stripe update failed"));

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "scale",
        targetInterval: "monthly",
      })
    ).rejects.toThrow("stripe update failed");

    expect(mocks.subscriptionSchedulesRelease).not.toHaveBeenCalledWith("sched_existing", {
      preserve_cancel_date: false,
    });
  });

  test("switchOrganizationToCloudPlan rejects schedules without a current phase end date", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: null,
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "pro",
        interval: "monthly",
        hasPaymentMethod: true,
      },
    });
    mocks.subscriptionSchedulesCreate.mockResolvedValue({
      id: "sched_new",
      current_phase: { start_date: 1739923200, end_date: null },
      phases: [{ start_date: 1739923200, end_date: null, items: [] }],
    });

    await expect(
      switchOrganizationToCloudPlan({
        organizationId: "org_1",
        customerId: "cus_1",
        targetPlan: "hobby",
        targetInterval: "monthly",
      })
    ).rejects.toThrow("current phase has no end date");

    expect(mocks.subscriptionSchedulesUpdate).not.toHaveBeenCalled();
  });

  test("undoPendingOrganizationPlanChange clears the pending snapshot", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: "sched_existing",
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {
        subscriptionId: "sub_1",
        plan: "pro",
        interval: "monthly",
        pendingChange: {
          type: "plan_change",
          targetPlan: "hobby",
          targetInterval: "monthly",
          effectiveAt: new Date(1742515200 * 1000).toISOString(),
        },
      },
    });

    await undoPendingOrganizationPlanChange("org_1", "cus_1");

    expect(mocks.subscriptionSchedulesRelease).toHaveBeenCalledWith("sched_existing", {
      preserve_cancel_date: false,
    });
    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: {
        stripe: expect.objectContaining({
          subscriptionId: "sub_1",
          plan: "pro",
          interval: "monthly",
          pendingChange: null,
          lastSyncedAt: expect.any(String),
        }),
      },
    });
  });

  test("syncOrganizationBillingFromStripe stores unlimited responses when entitlement is unlimited", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: { lastSyncedEventId: null },
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_scale", metadata: { formbricks_plan: "scale" } },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.entitlementsList.mockResolvedValue({
      data: [
        { id: "ent_0", lookup_key: "workspace-limit-5" },
        { id: "ent_1", lookup_key: "responses-included-unlimited" },
      ],
      has_more: false,
    });

    const result = await syncOrganizationBillingFromStripe("org_1", {
      id: "evt_unlimited",
      created: 1739923300,
    });

    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: expect.objectContaining({
        limits: {
          workspaces: 5,
          monthly: {
            responses: null,
          },
        },
        stripe: expect.objectContaining({
          features: ["workspace-limit-5", "responses-included-unlimited"],
          lastSyncedEventId: "evt_unlimited",
        }),
      }),
    });
    expect(result?.limits.monthly.responses).toBeNull();
    expect(result?.stripe?.features).toEqual(["workspace-limit-5", "responses-included-unlimited"]);
  });

  test("syncOrganizationBillingFromStripe mirrors a pending downgrade from subscription schedule", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: { lastSyncedEventId: null },
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: { id: "sched_1" },
          items: {
            data: [
              {
                id: "si_pro_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_pro_monthly",
                  metadata: {
                    formbricks_plan: "pro",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" } },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.subscriptionSchedulesRetrieve.mockResolvedValue({
      id: "sched_1",
      current_phase: { start_date: 1739923200, end_date: 1742515200 },
      phases: [
        {
          start_date: 1739923200,
          end_date: 1742515200,
          items: [{ price: "price_pro_monthly", quantity: 1 }],
        },
        {
          start_date: 1742515200,
          items: [{ price: "price_hobby_monthly", quantity: 1 }],
        },
      ],
    });

    const result = await syncOrganizationBillingFromStripe("org_1", {
      id: "evt_schedule",
      created: 1739923300,
    });

    expect(mocks.subscriptionsList).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 20,
      expand: ["data.schedule"],
    });
    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: {
        stripeCustomerId: "cus_1",
        limits: {
          workspaces: 3,
          monthly: {
            responses: 1500,
          },
        },
        stripe: expect.objectContaining({
          plan: "pro",
          pendingChange: {
            type: "plan_change",
            targetPlan: "hobby",
            targetInterval: "monthly",
            effectiveAt: new Date(1742515200 * 1000).toISOString(),
          },
        }),
        usageCycleAnchor: expect.any(Date),
      },
    });
    expect(result?.stripe?.pendingChange).toEqual({
      type: "plan_change",
      targetPlan: "hobby",
      targetInterval: "monthly",
      effectiveAt: new Date(1742515200 * 1000).toISOString(),
    });
  });

  test("syncOrganizationBillingFromStripe prefers unlimited responses over numeric response entitlements", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {},
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_scale", metadata: { formbricks_plan: "scale" } },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.entitlementsList.mockResolvedValue({
      data: [
        { id: "ent_0", lookup_key: "responses-included-500" },
        { id: "ent_1", lookup_key: "responses-included-unlimited" },
      ],
      has_more: false,
    });

    const result = await syncOrganizationBillingFromStripe("org_1");

    expect(result?.limits.monthly.responses).toBeNull();
    expect(result?.stripe?.features).toEqual(["responses-included-500", "responses-included-unlimited"]);
  });

  test("syncOrganizationBillingFromStripe preserves previous response limit when no response entitlement exists", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {},
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" } },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.entitlementsList.mockResolvedValue({
      data: [{ id: "ent_0", lookup_key: "workspace-limit-5" }],
      has_more: false,
    });

    const result = await syncOrganizationBillingFromStripe("org_1");

    expect(result?.limits.monthly.responses).toBe(500);
    expect(result?.stripe?.features).toEqual(["workspace-limit-5"]);
  });

  test("syncOrganizationBillingFromStripe prefers higher-tier active subscription over hobby", async () => {
    mocks.getCloudPlanFromProduct.mockImplementation(
      (product: { metadata?: { formbricks_plan?: string } }) => {
        if (product.metadata?.formbricks_plan === "hobby") return "hobby";
        if (product.metadata?.formbricks_plan === "pro") return "pro";
        return "unknown";
      }
    );
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {},
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_hobby",
          created: 1739923100,
          status: "active",
          billing_cycle_anchor: 1739923100,
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_hobby", metadata: { formbricks_plan: "hobby" } },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
        {
          id: "sub_pro",
          created: 1739923200,
          status: "active",
          billing_cycle_anchor: 1739923200,
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" } },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });

    const result = await syncOrganizationBillingFromStripe("org_1");

    expect(result?.stripe?.subscriptionId).toBe("sub_pro");
    expect(result?.stripe?.plan).toBe("pro");
  });

  describe("syncOrganizationBillingFromStripe paid-subscription lifecycle events", () => {
    const buildActiveSubscription = (
      plan: "pro" | "scale",
      status: "active" | "past_due" | "unpaid" | "paused" | "trialing"
    ) => ({
      id: `sub_${plan}`,
      created: 1739923200,
      status,
      billing_cycle_anchor: 1739923200,
      items: {
        data: [
          {
            price: {
              metadata: {
                formbricks_plan: plan,
                formbricks_price_kind: "base",
                formbricks_interval: "monthly",
              },
              product: { id: `prod_${plan}`, metadata: { formbricks_plan: plan } },
              recurring: { usage_type: "licensed", interval: "month" },
            },
          },
        ],
      },
    });

    beforeEach(() => {
      // Resolve the cloud plan from product metadata so each case can drive its own plan.
      mocks.getCloudPlanFromProduct.mockImplementation(
        (product: { metadata?: { formbricks_plan?: string } }) =>
          product.metadata?.formbricks_plan ?? "unknown"
      );
      mocks.entitlementsList.mockResolvedValue({ data: [], has_more: false });
      mocks.prismaMembershipFindFirst.mockResolvedValue({
        user: { id: "owner_1", email: "owner@example.com", name: "Owner" },
      });
    });

    // status/plan here describe the persisted snapshot before the sync; `incoming` is what
    // Stripe now resolves to (empty subscription list ⇒ hobby / canceled).
    const cases: {
      name: string;
      existingStripe: Record<string, unknown>;
      incoming: {
        plan: "pro" | "scale";
        status: "active" | "past_due" | "unpaid" | "paused" | "trialing";
      } | null;
      expectedEvent: "subscription_started" | "subscription_canceled" | "subscription_updated" | null;
      expectedPlan?: string | null;
    }[] = [
      {
        name: "emits subscription_started on first paid activation",
        existingStripe: { plan: "hobby", subscriptionStatus: null },
        incoming: { plan: "pro", status: "active" },
        expectedEvent: "subscription_started",
        expectedPlan: "pro",
      },
      {
        name: "emits subscription_canceled on voluntary cancel (active → ended)",
        existingStripe: { plan: "pro", subscriptionStatus: "active", interval: "monthly" },
        incoming: null,
        expectedEvent: "subscription_canceled",
        expectedPlan: "pro",
      },
      {
        name: "emits subscription_canceled on involuntary (dunning) churn (past_due → ended)",
        existingStripe: { plan: "pro", subscriptionStatus: "past_due", interval: "monthly" },
        incoming: null,
        expectedEvent: "subscription_canceled",
        expectedPlan: "pro",
      },
      {
        name: "emits subscription_updated on Pro → Scale switch",
        existingStripe: { plan: "pro", subscriptionStatus: "active", interval: "monthly" },
        incoming: { plan: "scale", status: "active" },
        expectedEvent: "subscription_updated",
        expectedPlan: "scale",
      },
      {
        name: "emits nothing on dunning recovery (past_due → active, same plan)",
        existingStripe: { plan: "pro", subscriptionStatus: "past_due", interval: "monthly" },
        incoming: { plan: "pro", status: "active" },
        expectedEvent: null,
      },
      {
        name: "emits nothing when a trial lapses without conversion (trialing → ended)",
        existingStripe: { plan: "pro", subscriptionStatus: "trialing", interval: "monthly" },
        incoming: null,
        expectedEvent: null,
      },
      {
        name: "emits nothing when an active paid plan is unchanged",
        existingStripe: { plan: "pro", subscriptionStatus: "active", interval: "monthly" },
        incoming: { plan: "pro", status: "active" },
        expectedEvent: null,
      },
    ];

    test.each(cases)("$name", async ({ existingStripe, incoming, expectedEvent, expectedPlan }) => {
      mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
        stripeCustomerId: "cus_1",
        limits: { workspaces: 3, monthly: { responses: 1500 } },
        usageCycleAnchor: new Date(),
        stripe: { ...existingStripe, lastSyncedEventId: null },
      });
      mocks.subscriptionsList.mockResolvedValue({
        data: incoming ? [buildActiveSubscription(incoming.plan, incoming.status)] : [],
      });

      await syncOrganizationBillingFromStripe("org_1", { id: "evt_1", created: 1739923300 });

      if (!expectedEvent) {
        expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
        return;
      }

      expect(mocks.capturePostHogEvent).toHaveBeenCalledTimes(1);
      expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
        "owner_1",
        expectedEvent,
        expect.objectContaining({ organization_id: "org_1", plan: expectedPlan }),
        { organizationId: "org_1" }
      );
    });

    test("does not reject the sync when the owner lookup fails after persistence", async () => {
      mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
        stripeCustomerId: "cus_1",
        limits: { workspaces: 3, monthly: { responses: 1500 } },
        usageCycleAnchor: new Date(),
        stripe: { plan: "pro", subscriptionStatus: "active", interval: "monthly", lastSyncedEventId: null },
      });
      mocks.subscriptionsList.mockResolvedValue({ data: [] });
      mocks.prismaMembershipFindFirst.mockRejectedValue(new Error("db blip"));

      const result = await syncOrganizationBillingFromStripe("org_1", { id: "evt_1", created: 1739923300 });

      expect(result?.stripe?.plan).toBe("hobby");
      expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalled();
      expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
      expect(mocks.loggerError).toHaveBeenCalledWith(
        { error: expect.any(Error), organizationId: "org_1" },
        "Failed to emit subscription lifecycle event to PostHog"
      );
    });
  });

  test("getOrganizationBillingWithReadThroughSync returns cached billing when no stripe customer exists", async () => {
    const cachedBilling = {
      stripeCustomerId: null,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date().toISOString(),
    };
    mocks.cacheWithCacheNullable.mockResolvedValue(cachedBilling);

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.prismaOrganizationBillingFindUnique).not.toHaveBeenCalled();
  });

  test("getOrganizationBillingWithReadThroughSync returns fresh cached billing without sync", async () => {
    const cachedBilling = {
      stripeCustomerId: "cus_1",
      stripe: { lastSyncedAt: new Date().toISOString() },
    };
    mocks.cacheWithCacheNullable.mockResolvedValue(cachedBilling);

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.prismaOrganizationBillingFindUnique).not.toHaveBeenCalled();
  });

  test("getOrganizationBillingWithReadThroughSync falls back to cached billing when sync fails", async () => {
    const cachedBilling = {
      stripeCustomerId: "cus_1",
      stripe: { lastSyncedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
    };
    mocks.cacheWithCacheNullable.mockResolvedValue(cachedBilling);
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: { lastSyncedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
    });
    mocks.subscriptionsList.mockRejectedValue(new Error("stripe down"));

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error: expect.any(Error), organizationId: "org_1" },
      "Failed to refresh billing snapshot from Stripe"
    );
  });

  test("getOrganizationBillingWithReadThroughSync bypasses Redis cache in self-hosted mode", async () => {
    mocks.isCloud = false;
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: null,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: null,
    });

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(mocks.cacheWithCacheNullable).not.toHaveBeenCalled();
    expect(result).toEqual({
      stripeCustomerId: null,
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: expect.any(Date),
    });
  });

  test("getOrganizationBillingWithReadThroughSync returns null when organization billing is missing", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue(null);
    mocks.cacheWithCacheNullable.mockImplementation(async (fn: () => Promise<unknown>) => await fn());

    await expect(getOrganizationBillingWithReadThroughSync("org_1")).resolves.toBeNull();
  });

  test("findOrganizationIdByStripeCustomerId returns matching organization id", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({ organizationId: "org_1" });

    const result = await findOrganizationIdByStripeCustomerId("cus_1");

    expect(result).toBe("org_1");
    expect(mocks.prismaOrganizationBillingFindUnique).toHaveBeenCalledWith({
      where: {
        stripeCustomerId: "cus_1",
      },
      select: { organizationId: true },
    });
  });

  test("ensureCloudStripeSetupForOrganization does nothing when cloud mode is disabled", async () => {
    mocks.isCloud = false;

    await ensureCloudStripeSetupForOrganization("org_1");

    expect(mocks.prismaOrganizationFindUnique).not.toHaveBeenCalled();
  });

  test("ensureCloudStripeSetupForOrganization creates customer, provisions hobby subscription, and syncs billing", async () => {
    mocks.prismaOrganizationFindUnique.mockResolvedValueOnce({
      id: "org_1",
      name: "Org 1",
    });
    mocks.prismaMembershipFindFirst.mockResolvedValue({
      user: { email: "owner@example.com", name: "Owner Name" },
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_new",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {},
    });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });
    mocks.subscriptionsList.mockResolvedValue({ data: [] });

    await ensureCloudStripeSetupForOrganization("org_1");

    expect(mocks.customersCreate).toHaveBeenCalledWith(
      {
        name: "Owner Name",
        email: "owner@example.com",
        metadata: { organizationId: "org_1", organizationName: "Org 1" },
      },
      { idempotencyKey: "ensure-customer-org_1" }
    );
    expect(mocks.subscriptionsCreate).toHaveBeenCalledWith(
      {
        customer: "cus_new",
        items: [{ price: "price_hobby_monthly", quantity: 1 }],
        metadata: { organizationId: "org_1" },
      },
      { idempotencyKey: "ensure-hobby-subscription-org_1-0" }
    );
    expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      data: expect.objectContaining({
        stripeCustomerId: "cus_new",
        stripe: expect.objectContaining({
          plan: "hobby",
          subscriptionStatus: null,
          subscriptionId: null,
        }),
      }),
    });
  });

  test("reconcileCloudStripeSubscriptionsForOrganization cancels hobby when paid subscription is active", async () => {
    mocks.getCloudPlanFromProduct.mockImplementation(
      (product: { metadata?: { formbricks_plan?: string } }) => {
        if (product.metadata?.formbricks_plan === "hobby") return "hobby";
        if (product.metadata?.formbricks_plan === "pro") return "pro";
        return "unknown";
      }
    );
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        workspaces: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: {},
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_hobby",
          created: 1739923100,
          status: "active",
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_hobby", metadata: { formbricks_plan: "hobby" } },
                },
              },
            ],
          },
        },
        {
          id: "sub_pro",
          created: 1739923200,
          status: "active",
          items: {
            data: [
              {
                price: {
                  metadata: {},
                  product: { id: "prod_pro", metadata: { formbricks_plan: "pro" } },
                },
              },
            ],
          },
        },
      ],
    });

    await reconcileCloudStripeSubscriptionsForOrganization("org_1");

    expect(mocks.subscriptionsCancel).toHaveBeenCalledWith("sub_hobby", { prorate: false });
    expect(mocks.subscriptionsCreate).not.toHaveBeenCalled();
  });

  describe("addOptimisticBillingFeature", () => {
    test("adds the feature when it is not already present and preserves every other stripe field", async () => {
      const existingStripe = {
        plan: "pro",
        interval: "monthly",
        subscriptionStatus: "trialing",
        subscriptionId: "sub_123",
        hasPaymentMethod: false,
        features: ["existing-feature"],
        pendingChange: null,
        lastStripeEventCreatedAt: null,
        lastSyncedAt: "2024-01-01T00:00:00.000Z",
        lastSyncedEventId: null,
        trialEnd: "2024-02-01T00:00:00.000Z",
      };
      mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
        stripeCustomerId: "cus_1",
        limits: { workspaces: 3, monthly: { responses: 1500 } },
        usageCycleAnchor: new Date("2024-01-01"),
        stripe: existingStripe,
      });

      await addOptimisticBillingFeature("org_1", "ai-smart-tools");

      expect(mocks.prismaOrganizationBillingUpdate).toHaveBeenCalledWith({
        where: { organizationId: "org_1" },
        data: {
          stripe: {
            ...existingStripe,
            features: ["existing-feature", "ai-smart-tools"],
          },
        },
      });
      expect(mocks.cacheDel).toHaveBeenCalled();
    });

    test("is a no-op when the feature is already present", async () => {
      mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
        stripeCustomerId: "cus_1",
        limits: { workspaces: 3, monthly: { responses: 1500 } },
        usageCycleAnchor: new Date("2024-01-01"),
        stripe: {
          lastSyncedAt: "2024-01-01T00:00:00.000Z",
          features: ["ai-smart-tools", "contacts"],
        },
      });

      await addOptimisticBillingFeature("org_1", "ai-smart-tools");

      expect(mocks.prismaOrganizationBillingUpdate).not.toHaveBeenCalled();
      expect(mocks.cacheDel).not.toHaveBeenCalled();
    });

    test("is a no-op when no billing record exists", async () => {
      mocks.prismaOrganizationBillingFindUnique.mockResolvedValue(null);
      mocks.prismaOrganizationFindUnique.mockResolvedValue(null);

      await addOptimisticBillingFeature("org_1", "ai-smart-tools");

      expect(mocks.prismaOrganizationBillingUpdate).not.toHaveBeenCalled();
      expect(mocks.cacheDel).not.toHaveBeenCalled();
    });

    test("is a no-op when the billing snapshot has no stripe object", async () => {
      mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
        stripeCustomerId: null,
        limits: { workspaces: 3, monthly: { responses: 1500 } },
        usageCycleAnchor: new Date("2024-01-01"),
        stripe: null,
      });

      await addOptimisticBillingFeature("org_1", "ai-smart-tools");

      expect(mocks.prismaOrganizationBillingUpdate).not.toHaveBeenCalled();
      expect(mocks.cacheDel).not.toHaveBeenCalled();
    });
  });

  const mockHobbySubscriptionForUpgrade = () => {
    mocks.getCloudPlanFromProduct.mockImplementation((product: { id?: string } | string) => {
      const productId = typeof product === "string" ? product : product.id;
      return productId === "prod_hobby" ? "hobby" : "pro";
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          billing_cycle_anchor: 1739923200,
          cancel_at_period_end: false,
          schedule: null,
          items: {
            data: [
              {
                id: "si_hobby_base",
                current_period_end: 1742515200,
                price: {
                  id: "price_hobby_monthly",
                  metadata: {
                    formbricks_plan: "hobby",
                    formbricks_price_kind: "base",
                    formbricks_interval: "monthly",
                  },
                  product: { id: "prod_hobby", metadata: { formbricks_plan: "hobby" }, active: true },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { workspaces: 1, monthly: { responses: 500 } },
      usageCycleAnchor: new Date(),
      stripe: { subscriptionId: "sub_1", plan: "hobby", interval: "monthly", hasPaymentMethod: false },
    });
  };

  test("applySetupCheckoutUpgrade attaches the saved card then upgrades hobby to pro", async () => {
    mockHobbySubscriptionForUpgrade();
    mocks.checkoutSessionsRetrieve.mockResolvedValue({
      mode: "setup",
      status: "complete",
      customer: "cus_1",
      setup_intent: { payment_method: "pm_1" },
      metadata: {
        organizationId: "org_1",
        subscriptionId: "sub_1",
        targetPlan: "pro",
        targetInterval: "monthly",
      },
    });

    const result = await applySetupCheckoutUpgrade({ organizationId: "org_1", checkoutSessionId: "cs_1" });

    expect(result.targetPlan).toBe("pro");
    expect(result.mode).toBe("immediate");
    // Card is attached to the customer + subscription synchronously, before the charge.
    expect(mocks.customersUpdate).toHaveBeenCalledWith("cus_1", {
      invoice_settings: { default_payment_method: "pm_1" },
    });
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith("sub_1", {
      default_payment_method: "pm_1",
    });
    // Upgrade uses pending_if_incomplete so the plan is granted only once paid.
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
      })
    );
  });

  test("applySetupCheckoutUpgrade rejects a session belonging to another organization", async () => {
    mocks.checkoutSessionsRetrieve.mockResolvedValue({
      mode: "setup",
      status: "complete",
      customer: "cus_1",
      setup_intent: { payment_method: "pm_1" },
      metadata: { organizationId: "org_other", targetPlan: "pro", targetInterval: "monthly" },
    });

    await expect(
      applySetupCheckoutUpgrade({ organizationId: "org_1", checkoutSessionId: "cs_1" })
    ).rejects.toThrow();
    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalled();
  });

  test("applySetupCheckoutUpgrade is a no-op without a valid target plan", async () => {
    mocks.checkoutSessionsRetrieve.mockResolvedValue({
      mode: "setup",
      status: "complete",
      customer: "cus_1",
      setup_intent: { payment_method: "pm_1" },
      metadata: { organizationId: "org_1", targetPlan: "hobby", targetInterval: "monthly" },
    });

    const result = await applySetupCheckoutUpgrade({ organizationId: "org_1", checkoutSessionId: "cs_1" });

    expect(result.targetPlan).toBeNull();
    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalled();
  });
});

describe("computeUnusedTrialCreditCents", () => {
  const NOW = 1_800_000_000; // fixed reference "now" in seconds
  const day = (n: number) => NOW + n * 86_400;

  test("credits the unused trial days at the daily rate (14/30 of the charge)", () => {
    // round(8900 * 14 / 30) = 4153
    expect(
      computeUnusedTrialCreditCents({ fullChargeCents: 8900, trialEndSeconds: day(14), nowSeconds: NOW })
    ).toBe(4153);
  });

  test("credits less as fewer trial days remain", () => {
    const c7 = computeUnusedTrialCreditCents({
      fullChargeCents: 8900,
      trialEndSeconds: day(7),
      nowSeconds: NOW,
    });
    const c14 = computeUnusedTrialCreditCents({
      fullChargeCents: 8900,
      trialEndSeconds: day(14),
      nowSeconds: NOW,
    });
    expect(c7).toBeLessThan(c14);
    expect(c7).toBe(2077); // round(8900 * 7 / 30)
  });

  test("no credit when the trial has already ended", () => {
    expect(
      computeUnusedTrialCreditCents({ fullChargeCents: 8900, trialEndSeconds: day(-1), nowSeconds: NOW })
    ).toBe(0);
    expect(
      computeUnusedTrialCreditCents({ fullChargeCents: 8900, trialEndSeconds: NOW, nowSeconds: NOW })
    ).toBe(0);
  });

  test("no credit without a trial end or a positive charge", () => {
    expect(
      computeUnusedTrialCreditCents({ fullChargeCents: 8900, trialEndSeconds: null, nowSeconds: NOW })
    ).toBe(0);
    expect(
      computeUnusedTrialCreditCents({ fullChargeCents: 0, trialEndSeconds: day(14), nowSeconds: NOW })
    ).toBe(0);
    expect(
      computeUnusedTrialCreditCents({ fullChargeCents: -100, trialEndSeconds: day(14), nowSeconds: NOW })
    ).toBe(0);
  });

  test("credit always leaves a payable amount so the card is still authorized", () => {
    // An absurdly long remaining window must not credit the whole charge: a fully-credited invoice
    // settles at $0 without a payment attempt, which would activate a paid plan on a card Stripe
    // never authorized (the exact hole payment_behavior: "error_if_incomplete" exists to close).
    const credit = computeUnusedTrialCreditCents({
      fullChargeCents: 8900,
      trialEndSeconds: day(365),
      nowSeconds: NOW,
    });
    expect(credit).toBe(8899); // capped at the billing-period days, minus the 1-cent floor
    expect(8900 - credit).toBeGreaterThan(0);
  });

  test("uses a 365-day basis for a yearly interval (does not over-credit against the yearly price)", () => {
    // 14 unused trial days against an 89,000-cent yearly price: round(89000 * 14 / 365) = 3414.
    // The default (monthly, /30) basis would wrongly credit round(89000 * 14 / 30) = 41,533 — ~12x.
    const yearly = computeUnusedTrialCreditCents({
      fullChargeCents: 89_000,
      trialEndSeconds: day(14),
      nowSeconds: NOW,
      interval: "yearly",
    });
    expect(yearly).toBe(3414);

    const monthly = computeUnusedTrialCreditCents({
      fullChargeCents: 89_000,
      trialEndSeconds: day(14),
      nowSeconds: NOW,
      interval: "monthly",
    });
    expect(monthly).toBe(41_533);
    expect(yearly).toBeLessThan(monthly);
  });
});
