import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  pricesList: vi.fn(),
}));

vi.mock("./stripe-client", () => ({
  stripeClient: {
    prices: {
      list: mocks.pricesList,
    },
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
});
