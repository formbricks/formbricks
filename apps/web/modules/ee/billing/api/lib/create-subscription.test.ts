import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS,
  CLOUD_STRIPE_PRODUCT_IDS,
} from "@/modules/billing/lib/stripe-catalog";
import { createSubscription } from "./create-subscription";

const mocks = vi.hoisted(() => ({
  pricesList: vi.fn(),
  subscriptionsList: vi.fn(),
  checkoutSessionCreate: vi.fn(),
  getOrganization: vi.fn(),
  ensureStripeCustomerForOrganization: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_123",
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    WEBAPP_URL: "https://app.formbricks.com",
  };
});

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
}));

vi.mock("@/modules/billing/lib/organization-billing", () => ({
  ensureStripeCustomerForOrganization: mocks.ensureStripeCustomerForOrganization,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    prices = { list: mocks.pricesList };
    subscriptions = { list: mocks.subscriptionsList };
    checkout = { sessions: { create: mocks.checkoutSessionCreate } };
  },
}));

describe("createSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getOrganization.mockResolvedValue({ id: "org_1", name: "Org 1" });
    mocks.ensureStripeCustomerForOrganization.mockResolvedValue({ customerId: "cus_1" });
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          items: {
            data: [
              {
                price: {
                  product: CLOUD_STRIPE_PRODUCT_IDS.HOBBY,
                },
              },
            ],
          },
        },
      ],
    });
    mocks.checkoutSessionCreate.mockResolvedValue({ url: "https://stripe.test/session_1" });
  });

  test("does not send quantity for metered prices and applies trial for first paid upgrade", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_pro_monthly",
          lookup_key: CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY,
          recurring: { usage_type: "licensed" },
        },
        {
          id: "price_pro_usage",
          lookup_key: CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_USAGE_RESPONSES,
          recurring: { usage_type: "metered" },
        },
      ],
    });

    const result = await createSubscription("org_1", "env_1", CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY);

    expect(mocks.checkoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_1",
        line_items: [{ price: "price_pro_monthly", quantity: 1 }, { price: "price_pro_usage" }],
        subscription_data: expect.objectContaining({
          trial_period_days: 14,
        }),
        customer_update: { address: "auto", name: "auto" },
      })
    );
    expect(result.status).toBe(200);
  });

  test("does not apply trial when customer already has paid subscription history", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        {
          items: {
            data: [
              {
                price: {
                  product: CLOUD_STRIPE_PRODUCT_IDS.PRO,
                },
              },
            ],
          },
        },
      ],
    });
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_pro_monthly",
          lookup_key: CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY,
          recurring: { usage_type: "licensed" },
        },
        {
          id: "price_pro_usage",
          lookup_key: CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_USAGE_RESPONSES,
          recurring: { usage_type: "metered" },
        },
      ],
    });

    await createSubscription("org_1", "env_1", CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY);

    expect(mocks.checkoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.not.objectContaining({
          trial_period_days: 14,
        }),
      })
    );
  });

  test("returns newPlan false on checkout creation error", async () => {
    mocks.pricesList.mockResolvedValue({
      data: [
        {
          id: "price_pro_monthly",
          lookup_key: CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY,
          recurring: { usage_type: "licensed" },
        },
        {
          id: "price_pro_usage",
          lookup_key: CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_USAGE_RESPONSES,
          recurring: { usage_type: "metered" },
        },
      ],
    });
    mocks.checkoutSessionCreate.mockRejectedValue(new Error("stripe down"));

    const result = await createSubscription("org_1", "env_1", CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY);

    expect(result.status).toBe(500);
    expect(result.newPlan).toBe(false);
  });
});
