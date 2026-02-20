import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  findOrganizationIdByStripeCustomerId,
  getOrganizationBillingWithReadThroughSync,
  reconcileCloudStripeSubscriptionsForOrganization,
  syncOrganizationBillingFromStripe,
} from "./organization-billing";

const mocks = vi.hoisted(() => ({
  isCloud: true,
  getBillingCacheKey: vi.fn(),
  prismaFindUnique: vi.fn(),
  prismaUpdate: vi.fn(),
  prismaFindFirst: vi.fn(),
  cacheWithCache: vi.fn(),
  cacheDel: vi.fn(),
  loggerWarn: vi.fn(),
  getCloudPlanFromProductId: vi.fn(),
  getLegacyPlanFromCloudPlan: vi.fn(),
  getLimitsFromCloudPlan: vi.fn(),
  customersCreate: vi.fn(),
  subscriptionsList: vi.fn(),
  subscriptionsCreate: vi.fn(),
  subscriptionsCancel: vi.fn(),
  pricesList: vi.fn(),
  entitlementsList: vi.fn(),
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
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findUnique: mocks.prismaFindUnique,
      update: mocks.prismaUpdate,
      findFirst: mocks.prismaFindFirst,
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
  },
}));

vi.mock("./stripe-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-catalog")>();
  return {
    ...actual,
    getCloudPlanFromProductId: mocks.getCloudPlanFromProductId,
    getLegacyPlanFromCloudPlan: mocks.getLegacyPlanFromCloudPlan,
    getLimitsFromCloudPlan: mocks.getLimitsFromCloudPlan,
  };
});

vi.mock("./stripe-client", () => ({
  stripeClient: {
    customers: { create: mocks.customersCreate },
    subscriptions: {
      list: mocks.subscriptionsList,
      create: mocks.subscriptionsCreate,
      cancel: mocks.subscriptionsCancel,
    },
    prices: { list: mocks.pricesList },
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
    mocks.getCloudPlanFromProductId.mockReturnValue("pro");
    mocks.getLegacyPlanFromCloudPlan.mockReturnValue("startup");
    mocks.getLimitsFromCloudPlan.mockReturnValue({
      projects: 3,
      responses: 2000,
      contacts: 5000,
    });
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.pricesList.mockResolvedValue({
      data: [{ id: "price_hobby_1" }],
    });
    mocks.entitlementsList.mockResolvedValue({ data: [], has_more: false });
  });

  test("ensureStripeCustomerForOrganization returns null when org does not exist", async () => {
    mocks.prismaFindUnique.mockResolvedValue(null);

    const result = await ensureStripeCustomerForOrganization("org_missing");

    expect(result).toEqual({ customerId: null });
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  test("ensureStripeCustomerForOrganization returns existing customer id", async () => {
    mocks.prismaFindUnique.mockResolvedValue({
      id: "org_1",
      name: "Org 1",
      billing: { stripeCustomerId: "cus_existing" },
    });

    const result = await ensureStripeCustomerForOrganization("org_1");

    expect(result).toEqual({ customerId: "cus_existing" });
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.prismaUpdate).not.toHaveBeenCalled();
  });

  test("ensureStripeCustomerForOrganization creates and stores a Stripe customer", async () => {
    mocks.prismaFindUnique.mockResolvedValue({
      id: "org_1",
      name: "Org 1",
      billing: { plan: "free" },
    });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });

    const result = await ensureStripeCustomerForOrganization("org_1");

    expect(result).toEqual({ customerId: "cus_new" });
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      {
        name: "Org 1",
        metadata: { organizationId: "org_1" },
      },
      { idempotencyKey: "ensure-customer-org_1" }
    );
    expect(mocks.prismaUpdate).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: {
        billing: expect.objectContaining({
          stripeCustomerId: "cus_new",
          billingMode: "stripe",
          stripe: expect.objectContaining({
            lastSyncedAt: expect.any(String),
          }),
        }),
      },
    });
    expect(mocks.cacheDel).toHaveBeenCalledWith(["billing-cache-key"]);
  });

  test("syncOrganizationBillingFromStripe returns billing unchanged when customer is missing", async () => {
    const billing = { plan: "free" };
    mocks.prismaFindUnique.mockResolvedValue({ id: "org_1", billing });

    const result = await syncOrganizationBillingFromStripe("org_1");

    expect(result).toEqual(billing);
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
  });

  test("syncOrganizationBillingFromStripe ignores duplicate webhook events", async () => {
    const billing = {
      stripeCustomerId: "cus_1",
      stripe: {
        lastSyncedEventId: "evt_1",
        lastStripeEventCreatedAt: new Date("2026-02-19T00:00:00.000Z").toISOString(),
      },
    };
    mocks.prismaFindUnique.mockResolvedValue({ id: "org_1", billing });

    const result = await syncOrganizationBillingFromStripe("org_1", { id: "evt_1", created: 1739923200 });

    expect(result).toEqual(billing);
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
  });

  test("syncOrganizationBillingFromStripe ignores older webhook events", async () => {
    const billing = {
      stripeCustomerId: "cus_1",
      stripe: {
        lastStripeEventCreatedAt: "2026-02-20T00:00:00.000Z",
      },
    };
    mocks.prismaFindUnique.mockResolvedValue({ id: "org_1", billing });

    const result = await syncOrganizationBillingFromStripe("org_1", { id: "evt_old", created: 1739923200 });

    expect(result).toEqual(billing);
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
  });

  test("syncOrganizationBillingFromStripe stores normalized stripe snapshot", async () => {
    mocks.prismaFindUnique.mockResolvedValue({
      id: "org_1",
      billing: { stripeCustomerId: "cus_1", stripe: { lastSyncedEventId: null } },
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_1",
          status: "active",
          current_period_start: 1739923200,
          items: {
            data: [
              {
                price: {
                  product: { id: "prod_pro" },
                  recurring: { usage_type: "licensed", interval: "year" },
                },
              },
            ],
          },
        },
      ],
    });
    mocks.entitlementsList.mockResolvedValue({
      data: [
        { id: "ent_1", lookup_key: "custom-links-in-surveys" },
        { id: "ent_2", lookup_key: "custom-links-in-surveys" },
        { id: "ent_3", lookup_key: null },
      ],
      has_more: false,
    });

    const result = await syncOrganizationBillingFromStripe("org_1", { id: "evt_new", created: 1739923300 });

    expect(mocks.prismaUpdate).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: {
        billing: expect.objectContaining({
          stripeCustomerId: "cus_1",
          plan: "startup",
          period: "yearly",
          limits: {
            projects: 3,
            monthly: {
              responses: 2000,
              miu: 5000,
            },
          },
          stripe: expect.objectContaining({
            plan: "pro",
            subscriptionId: "sub_1",
            features: ["custom-links-in-surveys"],
            lastSyncedEventId: "evt_new",
            lastStripeEventCreatedAt: expect.any(String),
            lastSyncedAt: expect.any(String),
          }),
        }),
      },
    });
    expect(result?.stripe?.plan).toBe("pro");
    expect(result?.stripe?.features).toEqual(["custom-links-in-surveys"]);
    expect(mocks.cacheDel).toHaveBeenCalledWith(["billing-cache-key"]);
  });

  test("syncOrganizationBillingFromStripe prefers higher-tier active subscription over hobby", async () => {
    mocks.getCloudPlanFromProductId.mockImplementation((productId: string) => {
      if (productId === "prod_hobby") return "hobby";
      if (productId === "prod_pro") return "pro";
      return "unknown";
    });
    mocks.getLegacyPlanFromCloudPlan.mockImplementation((plan: string) =>
      plan === "pro" ? "startup" : "free"
    );
    mocks.getLimitsFromCloudPlan.mockImplementation((plan: string) =>
      plan === "pro"
        ? { projects: 3, responses: 2000, contacts: 5000 }
        : { projects: 1, responses: 250, contacts: null }
    );
    mocks.prismaFindUnique.mockResolvedValue({
      id: "org_1",
      billing: { stripeCustomerId: "cus_1", stripe: {} },
    });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_hobby",
          created: 1739923100,
          status: "active",
          current_period_start: 1739923100,
          items: {
            data: [
              {
                price: {
                  product: { id: "prod_hobby" },
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
          current_period_start: 1739923200,
          items: {
            data: [
              {
                price: {
                  product: { id: "prod_pro" },
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
    expect(result?.plan).toBe("startup");
  });

  test("getOrganizationBillingWithReadThroughSync returns cached billing when no stripe customer exists", async () => {
    const cachedBilling = { plan: "free" };
    mocks.cacheWithCache.mockResolvedValue(cachedBilling);

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  test("getOrganizationBillingWithReadThroughSync returns fresh cached billing without sync", async () => {
    const cachedBilling = {
      stripeCustomerId: "cus_1",
      stripe: { lastSyncedAt: new Date().toISOString() },
    };
    mocks.cacheWithCache.mockResolvedValue(cachedBilling);

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  test("getOrganizationBillingWithReadThroughSync falls back to cached billing when sync fails", async () => {
    const cachedBilling = {
      stripeCustomerId: "cus_1",
      stripe: { lastSyncedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
    };
    mocks.cacheWithCache.mockResolvedValue(cachedBilling);
    mocks.prismaFindUnique.mockResolvedValue({ id: "org_1", billing: cachedBilling });
    mocks.subscriptionsList.mockRejectedValue(new Error("stripe down"));

    const result = await getOrganizationBillingWithReadThroughSync("org_1");

    expect(result).toEqual(cachedBilling);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error: expect.any(Error), organizationId: "org_1" },
      "Failed to refresh billing snapshot from Stripe"
    );
  });

  test("findOrganizationIdByStripeCustomerId returns matching organization id", async () => {
    mocks.prismaFindFirst.mockResolvedValue({ id: "org_1" });

    const result = await findOrganizationIdByStripeCustomerId("cus_1");

    expect(result).toBe("org_1");
    expect(mocks.prismaFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { billing: { path: ["stripeCustomerId"], equals: "cus_1" } },
          { billing: { path: ["stripe", "customerId"], equals: "cus_1" } },
        ],
      },
      select: { id: true },
    });
  });

  test("ensureCloudStripeSetupForOrganization does nothing when cloud mode is disabled", async () => {
    mocks.isCloud = false;

    await ensureCloudStripeSetupForOrganization("org_1");

    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  test("ensureCloudStripeSetupForOrganization provisions hobby subscription when org has no active subscription", async () => {
    mocks.prismaFindUnique
      .mockResolvedValueOnce({
        id: "org_1",
        name: "Org 1",
        billing: { plan: "free" },
      })
      .mockResolvedValueOnce({
        id: "org_1",
        billing: { stripeCustomerId: "cus_new", stripe: {} },
      });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });
    mocks.subscriptionsList.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
      data: [
        {
          id: "sub_hobby",
          created: 1739923200,
          status: "active",
          current_period_start: 1739923200,
          items: {
            data: [
              {
                price: {
                  product: { id: "prod_hobby" },
                  recurring: { usage_type: "licensed", interval: "month" },
                },
              },
            ],
          },
        },
      ],
    });

    await ensureCloudStripeSetupForOrganization("org_1");

    expect(mocks.pricesList).toHaveBeenCalledWith({
      lookup_keys: ["price_hobby_monthly"],
      active: true,
      limit: 1,
    });
    expect(mocks.subscriptionsCreate).toHaveBeenCalledWith(
      {
        customer: "cus_new",
        items: [{ price: "price_hobby_1", quantity: 1 }],
        metadata: { organizationId: "org_1" },
      },
      { idempotencyKey: "ensure-hobby-subscription-org_1-bootstrap" }
    );
  });

  test("reconcileCloudStripeSubscriptionsForOrganization cancels hobby when paid subscription is active", async () => {
    mocks.getCloudPlanFromProductId.mockImplementation((productId: string) => {
      if (productId === "prod_hobby") return "hobby";
      if (productId === "prod_pro") return "pro";
      return "unknown";
    });
    mocks.prismaFindUnique.mockResolvedValue({
      id: "org_1",
      billing: { stripeCustomerId: "cus_1", stripe: {} },
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
                  product: { id: "prod_hobby" },
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
                  product: { id: "prod_pro" },
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
