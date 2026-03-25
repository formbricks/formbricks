import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createPaidPlanCheckoutSession,
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  findOrganizationIdByStripeCustomerId,
  getOrganizationBillingWithReadThroughSync,
  reconcileCloudStripeSubscriptionsForOrganization,
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
  cacheDel: vi.fn(),
  loggerWarn: vi.fn(),
  getCloudPlanFromProduct: vi.fn(),
  customersCreate: vi.fn(),
  checkoutSessionsCreate: vi.fn(),
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
    },
    products: {
      list: mocks.productsList,
      retrieve: mocks.productsRetrieve,
    },
    checkout: {
      sessions: {
        create: mocks.checkoutSessionsCreate,
      },
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCloud = true;
    mocks.getBillingCacheKey.mockReturnValue("billing-cache-key");
    mocks.getCustomCacheKey.mockImplementation(
      (namespace: string, identifier: string, subresource?: string) =>
        [namespace, identifier, subresource].filter(Boolean).join(":")
    );
    mocks.cacheWithCache.mockImplementation(async (fn: () => Promise<unknown>) => await fn());
    mocks.getCloudPlanFromProduct.mockReturnValue("pro");
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.customersList.mockResolvedValue({ data: [] });
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
        projects: 3,
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
        projects: 3,
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
    const billing = {
      stripeCustomerId: null,
      limits: {
        projects: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
    };
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      ...billing,
      usageCycleAnchor: new Date(),
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
        projects: 3,
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
        projects: 3,
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
        projects: 3,
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
        projects: 3,
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
          projects: 5,
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
        environmentId: "env_1",
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
        projects: 3,
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

  test("switchOrganizationToCloudPlan fails immediate upgrades when Stripe cannot collect the prorated invoice", async () => {
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
        projects: 3,
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
        payment_behavior: "error_if_incomplete",
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
        projects: 5,
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

    expect(result).toEqual({ mode: "immediate", pendingChange: null });
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
        projects: 3,
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
        projects: 5,
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
        projects: 3,
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
        projects: 3,
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
        projects: 3,
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
        projects: 3,
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
          projects: 5,
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
        projects: 3,
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
          projects: 3,
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
        projects: 3,
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
        projects: 3,
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
        projects: 3,
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

  test("getOrganizationBillingWithReadThroughSync returns cached billing when no stripe customer exists", async () => {
    const cachedBilling = {
      stripeCustomerId: null,
      limits: {
        projects: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date().toISOString(),
    };
    mocks.cacheWithCache.mockResolvedValue(cachedBilling);

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.prismaOrganizationBillingFindUnique).not.toHaveBeenCalled();
  });

  test("getOrganizationBillingWithReadThroughSync returns fresh cached billing without sync", async () => {
    const cachedBilling = {
      stripeCustomerId: "cus_1",
      stripe: { lastSyncedAt: new Date().toISOString() },
    };
    mocks.cacheWithCache.mockResolvedValue(cachedBilling);

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.prismaOrganizationBillingFindUnique).not.toHaveBeenCalled();
  });

  test("getOrganizationBillingWithReadThroughSync falls back to cached billing when sync fails", async () => {
    const cachedBilling = {
      stripeCustomerId: "cus_1",
      stripe: { lastSyncedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
    };
    mocks.cacheWithCache.mockResolvedValue(cachedBilling);
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: {
        projects: 3,
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
        projects: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: new Date(),
      stripe: null,
    });

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(mocks.cacheWithCache).not.toHaveBeenCalled();
    expect(result).toEqual({
      stripeCustomerId: null,
      limits: {
        projects: 3,
        monthly: {
          responses: 1500,
        },
      },
      usageCycleAnchor: expect.any(Date),
    });
  });

  test("getOrganizationBillingWithReadThroughSync returns null when organization billing is missing", async () => {
    mocks.prismaOrganizationBillingFindUnique.mockResolvedValue(null);
    mocks.cacheWithCache.mockImplementation(async (fn: () => Promise<unknown>) => await fn());

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
        projects: 3,
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
      { idempotencyKey: "ensure-hobby-subscription-org_1-bootstrap" }
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
        projects: 3,
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

    await reconcileCloudStripeSubscriptionsForOrganization("org_1", "evt_123");

    expect(mocks.subscriptionsCancel).toHaveBeenCalledWith("sub_hobby", { prorate: false });
    expect(mocks.subscriptionsCreate).not.toHaveBeenCalled();
  });
});
