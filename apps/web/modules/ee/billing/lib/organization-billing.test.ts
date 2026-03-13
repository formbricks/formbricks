import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  findOrganizationIdByStripeCustomerId,
  getOrganizationBillingWithReadThroughSync,
  reconcileCloudStripeSubscriptionsForOrganization,
  syncOrganizationBillingFromStripe,
} from "./organization-billing";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  isCloud: true,
  getBillingCacheKey: vi.fn(),
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
  productsList: vi.fn(),
  productsRetrieve: vi.fn(),
  subscriptionsList: vi.fn(),
  subscriptionsCreate: vi.fn(),
  subscriptionsCancel: vi.fn(),
  pricesList: vi.fn(),
  entitlementsList: vi.fn(),
  customersList: vi.fn(),
  customersRetrieve: vi.fn(),
  customersUpdate: vi.fn(),
  prismaMembershipFindFirst: vi.fn(),
  loggerInfo: vi.fn(),
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
    mocks.getCloudPlanFromProduct.mockReturnValue("pro");
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.customersList.mockResolvedValue({ data: [] });
    mocks.prismaMembershipFindFirst.mockResolvedValue(null);
    mocks.productsList.mockResolvedValue({
      data: [
        {
          id: "prod_hobby",
          metadata: { formbricks_plan: "hobby" },
          default_price: null,
        },
      ],
    });
    mocks.productsRetrieve.mockImplementation(async (productId: string) => ({
      id: productId,
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
      data: [{ id: "price_hobby_1" }],
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
  });

  test("ensureStripeCustomerForOrganization returns null when org does not exist", async () => {
    mocks.prismaOrganizationFindUnique.mockResolvedValue(null);

    const result = await ensureStripeCustomerForOrganization("org_missing");

    expect(result).toEqual({ customerId: null });
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  test("ensureStripeCustomerForOrganization reuses Stripe customer found by owner email", async () => {
    mocks.prismaOrganizationFindUnique.mockResolvedValue({
      id: "org_1",
      name: "Org 1",
    });
    mocks.prismaMembershipFindFirst.mockResolvedValue({
      user: { email: "owner@example.com", name: "Owner Name" },
    });
    mocks.customersList.mockResolvedValue({
      data: [{ id: "cus_existing", deleted: false }],
    });
    mocks.customersUpdate.mockResolvedValue({ id: "cus_existing" });

    const result = await ensureStripeCustomerForOrganization("org_1");

    expect(result).toEqual({ customerId: "cus_existing" });
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.customersUpdate).toHaveBeenCalledWith("cus_existing", {
      name: "Owner Name",
      metadata: { organizationId: "org_1", organizationName: "Org 1" },
    });
    expect(mocks.prismaOrganizationBillingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org_1" },
        create: expect.objectContaining({ stripeCustomerId: "cus_existing" }),
        update: expect.objectContaining({ stripeCustomerId: "cus_existing" }),
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
                  product: { id: "prod_scale" },
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
                  product: { id: "prod_scale" },
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
                  product: { id: "prod_pro" },
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

  test("ensureCloudStripeSetupForOrganization provisions hobby subscription when org has no active subscription", async () => {
    mocks.prismaOrganizationFindUnique.mockResolvedValueOnce({
      id: "org_1",
      name: "Org 1",
    });
    // ensureStripeCustomerForOrganization no longer reads billing;
    // reconcile and sync each read billing once
    mocks.prismaOrganizationBillingFindUnique
      .mockResolvedValueOnce({
        stripeCustomerId: "cus_new",
        limits: {
          projects: 3,
          monthly: {
            responses: 1500,
          },
        },
        usageCycleAnchor: new Date(),
        stripe: {},
      })
      .mockResolvedValueOnce({
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
    mocks.subscriptionsList
      .mockResolvedValueOnce({ data: [] }) // reconciliation initial list (status: "all")
      .mockResolvedValueOnce({ data: [] }) // fresh re-check before hobby creation (status: "active")
      .mockResolvedValueOnce({
        // sync reads subscriptions after hobby is created
        data: [
          {
            id: "sub_hobby",
            created: 1739923200,
            status: "active",
            billing_cycle_anchor: 1739923200,
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

    expect(mocks.productsList).toHaveBeenCalledWith({
      active: true,
      limit: 100,
    });
    expect(mocks.pricesList).toHaveBeenCalledWith({
      product: "prod_hobby",
      active: true,
      limit: 100,
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
