import { beforeEach, describe, expect, test, vi } from "vitest";
import { createSetupCheckoutSession } from "./create-setup-checkout-session";

const mocks = vi.hoisted(() => ({
  subscriptionsRetrieve: vi.fn(),
  checkoutSessionsCreate: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_123",
  },
}));

vi.mock("stripe", () => ({
  default: class MockStripe {
    subscriptions = {
      retrieve: mocks.subscriptionsRetrieve,
    };
    checkout = {
      sessions: {
        create: mocks.checkoutSessionsCreate,
      },
    };
  },
}));

describe("createSetupCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriptionsRetrieve.mockResolvedValue({ currency: "usd" });
    mocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.test/setup" });
  });

  test("creates payment-only setup checkout without upgrade metadata", async () => {
    const url = await createSetupCheckoutSession(
      "cus_1",
      "sub_1",
      "https://app.formbricks.com/workspaces/ws_1/settings/organization/billing",
      "org_1"
    );

    expect(url).toBe("https://checkout.stripe.test/setup");
    expect(mocks.checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          "https://app.formbricks.com/workspaces/ws_1/settings/organization/billing?checkout_success=1",
        metadata: {
          organizationId: "org_1",
          subscriptionId: "sub_1",
        },
      })
    );
  });

  test("creates setup checkout with upgrade metadata and pending success flag", async () => {
    await createSetupCheckoutSession(
      "cus_1",
      "sub_1",
      "https://app.formbricks.com/workspaces/ws_1/settings/organization/billing",
      "org_1",
      {
        targetPlan: "scale",
        targetInterval: "monthly",
      }
    );

    expect(mocks.checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          "https://app.formbricks.com/workspaces/ws_1/settings/organization/billing?checkout_success=1&upgrade_pending=1&session_id={CHECKOUT_SESSION_ID}",
        metadata: {
          organizationId: "org_1",
          subscriptionId: "sub_1",
          targetPlan: "scale",
          targetInterval: "monthly",
        },
      })
    );
  });
});
