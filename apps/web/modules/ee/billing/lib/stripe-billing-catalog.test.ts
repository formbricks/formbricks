import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  pricesList: vi.fn(),
  cacheWithCache: vi.fn(),
}));

vi.mock("./stripe-client", () => ({
  stripeClient: {
    prices: {
      list: mocks.pricesList,
    },
  },
}));

const cacheStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: mocks.cacheWithCache,
  },
}));

const createPrice = ({
  id,
  plan,
  kind,
  interval,
}: {
  id: string;
  plan: "hobby" | "pro" | "scale";
  kind: "base" | "responses";
  interval: "monthly" | "yearly";
}) => ({
  id,
  active: true,
  currency: "usd",
  unit_amount: kind === "responses" ? 0 : interval === "monthly" ? 1000 : 10000,
  metadata: {
    formbricks_plan: plan,
    formbricks_price_kind: kind,
    formbricks_interval: interval,
  },
  recurring: {
    usage_type: kind === "base" ? "licensed" : "metered",
    interval: interval === "monthly" ? "month" : "year",
  },
  product: {
    id: `prod_${plan}`,
    active: true,
    metadata: {
      formbricks_plan: plan,
    },
  },
});

describe("stripe-billing-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    cacheStore.clear();

    mocks.cacheWithCache.mockImplementation(async (fn: () => Promise<unknown>, key: string) => {
      if (cacheStore.has(key)) {
        return cacheStore.get(key);
      }

      const value = await fn();
      cacheStore.set(key, value);
      return value;
    });
  });

  test("resolves the metadata-backed billing catalog", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
        createPrice({ id: "price_pro_responses", plan: "pro", kind: "responses", interval: "monthly" }),
        createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
        createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
      ],
      has_more: false,
    });

    const { getCatalogItemsForPlan, getStripeBillingCatalogDisplay } =
      await import("./stripe-billing-catalog");

    await expect(getCatalogItemsForPlan("hobby", "monthly")).resolves.toEqual([
      { price: "price_hobby_monthly", quantity: 1 },
    ]);
    await expect(getCatalogItemsForPlan("pro", "yearly")).resolves.toEqual([
      { price: "price_pro_yearly", quantity: 1 },
      { price: "price_pro_responses" },
    ]);
    await expect(getStripeBillingCatalogDisplay()).resolves.toEqual({
      hobby: {
        monthly: {
          plan: "hobby",
          interval: "monthly",
          currency: "usd",
          unitAmount: 1000,
        },
      },
      pro: {
        monthly: {
          plan: "pro",
          interval: "monthly",
          currency: "usd",
          unitAmount: 1000,
        },
        yearly: {
          plan: "pro",
          interval: "yearly",
          currency: "usd",
          unitAmount: 10000,
        },
      },
      scale: {
        monthly: {
          plan: "scale",
          interval: "monthly",
          currency: "usd",
          unitAmount: 1000,
        },
        yearly: {
          plan: "scale",
          interval: "yearly",
          currency: "usd",
          unitAmount: 10000,
        },
      },
    });
  });

  test("fails fast when the catalog is incomplete", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" })],
      has_more: false,
    });

    const { getCatalogItemsForPlan } = await import("./stripe-billing-catalog");

    await expect(getCatalogItemsForPlan("pro", "monthly")).rejects.toThrow(
      "Expected exactly one Stripe price for pro/base/monthly, but found 0"
    );
  });

  test("reuses the shared cached catalog across module reloads", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
        createPrice({ id: "price_pro_responses", plan: "pro", kind: "responses", interval: "monthly" }),
        createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
        createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
      ],
      has_more: false,
    });

    const firstModule = await import("./stripe-billing-catalog");
    await firstModule.getStripeBillingCatalogDisplay();

    vi.resetModules();

    const secondModule = await import("./stripe-billing-catalog");
    await secondModule.getStripeBillingCatalogDisplay();

    expect(mocks.pricesList).toHaveBeenCalledTimes(1);
    expect(mocks.cacheWithCache).toHaveBeenCalledTimes(2);
  });

  test("falls back to direct Stripe fetch when shared cache is unavailable", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        createPrice({ id: "price_hobby_monthly", plan: "hobby", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_pro_monthly", plan: "pro", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_pro_yearly", plan: "pro", kind: "base", interval: "yearly" }),
        createPrice({ id: "price_pro_responses", plan: "pro", kind: "responses", interval: "monthly" }),
        createPrice({ id: "price_scale_monthly", plan: "scale", kind: "base", interval: "monthly" }),
        createPrice({ id: "price_scale_yearly", plan: "scale", kind: "base", interval: "yearly" }),
        createPrice({ id: "price_scale_responses", plan: "scale", kind: "responses", interval: "monthly" }),
      ],
      has_more: false,
    });
    mocks.cacheWithCache.mockImplementationOnce(async (fn: () => Promise<unknown>) => await fn());

    const { getStripeBillingCatalogDisplay } = await import("./stripe-billing-catalog");

    await expect(getStripeBillingCatalogDisplay()).resolves.toMatchObject({
      hobby: {
        monthly: {
          plan: "hobby",
        },
      },
    });
    expect(mocks.pricesList).toHaveBeenCalledTimes(1);
  });
});
