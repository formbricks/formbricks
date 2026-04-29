import Stripe from "stripe";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  findOrganizationIdByStripeCustomerId: vi.fn(),
  reconcileCloudStripeSubscriptionsForOrganization: vi.fn(),
  syncOrganizationBillingFromStripe: vi.fn(),
}));

vi.mock("./stripe-client", () => ({
  getStripeClient: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
}));

const hobbyProduct = {
  id: "prod_hobby",
  metadata: { formbricks_plan: "hobby" },
  deleted: false,
} as Stripe.Product;

const proProduct = {
  id: "prod_pro",
  metadata: { formbricks_plan: "pro" },
  deleted: false,
} as Stripe.Product;

const makeSubscriptionUpdatedEvent = (opts: {
  product: Stripe.Product;
  previousAttributes: Record<string, unknown>;
}): Stripe.Event =>
  ({
    type: "customer.subscription.updated",
    data: {
      object: {
        items: {
          data: [{ price: { product: opts.product } }],
        },
      },
      previous_attributes: opts.previousAttributes,
    },
  }) as unknown as Stripe.Event;

afterEach(() => {
  vi.clearAllMocks();
});

describe("isHobbySubscriptionRenewal", () => {
  let isHobbySubscriptionRenewal: (event: Stripe.Event) => boolean;

  beforeAll(async () => {
    const mod = await import("./stripe-webhook");
    isHobbySubscriptionRenewal = mod.isHobbySubscriptionRenewal;
  });

  test("returns true for hobby subscription with only billing period changes", () => {
    const event = makeSubscriptionUpdatedEvent({
      product: hobbyProduct,
      previousAttributes: {
        current_period_start: 1710000000,
        current_period_end: 1712678400,
        latest_invoice: "inv_old",
      },
    });

    expect(isHobbySubscriptionRenewal(event)).toBe(true);
  });

  test("returns false for pro subscription renewal", () => {
    const event = makeSubscriptionUpdatedEvent({
      product: proProduct,
      previousAttributes: {
        current_period_start: 1710000000,
        current_period_end: 1712678400,
      },
    });

    expect(isHobbySubscriptionRenewal(event)).toBe(false);
  });

  test("returns false when items changed (plan upgrade)", () => {
    const event = makeSubscriptionUpdatedEvent({
      product: hobbyProduct,
      previousAttributes: {
        current_period_start: 1710000000,
        items: { data: [] },
      },
    });

    expect(isHobbySubscriptionRenewal(event)).toBe(false);
  });

  test("returns false when status changed (cancellation)", () => {
    const event = makeSubscriptionUpdatedEvent({
      product: hobbyProduct,
      previousAttributes: {
        status: "active",
        current_period_end: 1712678400,
      },
    });

    expect(isHobbySubscriptionRenewal(event)).toBe(false);
  });

  test("returns false for non-subscription-updated events", () => {
    const event = {
      type: "customer.subscription.created",
      data: { object: {}, previous_attributes: {} },
    } as unknown as Stripe.Event;

    expect(isHobbySubscriptionRenewal(event)).toBe(false);
  });

  test("returns false when previous_attributes is missing", () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          items: { data: [{ price: { product: hobbyProduct } }] },
        },
      },
    } as unknown as Stripe.Event;

    expect(isHobbySubscriptionRenewal(event)).toBe(false);
  });

  test("returns false when product is a string (not expanded)", () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          items: { data: [{ price: { product: "prod_hobby" } }] },
        },
        previous_attributes: { current_period_start: 1710000000 },
      },
    } as unknown as Stripe.Event;

    expect(isHobbySubscriptionRenewal(event)).toBe(false);
  });

  test("returns true when only billing_cycle_anchor changes", () => {
    const event = makeSubscriptionUpdatedEvent({
      product: hobbyProduct,
      previousAttributes: {
        billing_cycle_anchor: 1710000000,
      },
    });

    expect(isHobbySubscriptionRenewal(event)).toBe(true);
  });

  test("returns false for mixed hobby and pro items", () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          items: {
            data: [{ price: { product: hobbyProduct } }, { price: { product: proProduct } }],
          },
        },
        previous_attributes: { current_period_start: 1710000000 },
      },
    } as unknown as Stripe.Event;

    expect(isHobbySubscriptionRenewal(event)).toBe(false);
  });
});
