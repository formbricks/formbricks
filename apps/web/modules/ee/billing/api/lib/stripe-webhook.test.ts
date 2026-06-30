import { beforeEach, describe, expect, test, vi } from "vitest";
import { webhookHandler } from "./stripe-webhook";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  setupIntentsRetrieve: vi.fn(),
  customersUpdate: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  getStripeClient: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
  applyPendingUpgradeFromSetupCheckout: vi.fn(),
  findOrganizationIdByStripeCustomerId: vi.fn(),
  reconcileCloudStripeSubscriptionsForOrganization: vi.fn(),
  syncOrganizationBillingFromStripe: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

const stripeClient = {
  webhooks: { constructEvent: mocks.constructEvent },
  setupIntents: { retrieve: mocks.setupIntentsRetrieve },
  customers: { update: mocks.customersUpdate },
  subscriptions: { update: mocks.subscriptionsUpdate },
};

vi.mock("./stripe-client", () => ({
  getStripeClient: mocks.getStripeClient,
  getStripeWebhookSecret: mocks.getStripeWebhookSecret,
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  applyPendingUpgradeFromSetupCheckout: mocks.applyPendingUpgradeFromSetupCheckout,
  findOrganizationIdByStripeCustomerId: mocks.findOrganizationIdByStripeCustomerId,
  reconcileCloudStripeSubscriptionsForOrganization: mocks.reconcileCloudStripeSubscriptionsForOrganization,
  syncOrganizationBillingFromStripe: mocks.syncOrganizationBillingFromStripe,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

const buildSetupCheckoutEvent = () => ({
  id: "evt_1",
  type: "checkout.session.completed",
  created: 1739923200,
  data: {
    object: {
      mode: "setup",
      setup_intent: "seti_1",
      customer: "cus_1",
      metadata: {
        organizationId: "org_1",
        subscriptionId: "sub_1",
        targetPlan: "pro",
        targetInterval: "monthly",
      },
    },
  },
});

describe("webhookHandler setup checkout upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStripeClient.mockReturnValue(stripeClient);
    mocks.getStripeWebhookSecret.mockReturnValue("whsec_test");
    mocks.constructEvent.mockImplementation(() => buildSetupCheckoutEvent());
    mocks.setupIntentsRetrieve.mockResolvedValue({ payment_method: "pm_1" });
    mocks.customersUpdate.mockResolvedValue({});
    mocks.subscriptionsUpdate.mockResolvedValue({});
    mocks.findOrganizationIdByStripeCustomerId.mockResolvedValue("org_1");
    mocks.reconcileCloudStripeSubscriptionsForOrganization.mockResolvedValue(undefined);
    mocks.syncOrganizationBillingFromStripe.mockResolvedValue(undefined);
  });

  test("returns 200 and does not retry when the upgrade charge fails", async () => {
    mocks.applyPendingUpgradeFromSetupCheckout.mockRejectedValue(new Error("card_declined"));

    const result = await webhookHandler("body", "sig");

    // Webhook must NOT 500 — a retry would re-attach the payment method and
    // re-attempt a charge that cannot succeed.
    expect(result.status).toBe(200);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org_1", customerId: "cus_1", targetPlan: "pro" }),
      "Failed to apply pending plan upgrade after setup checkout"
    );
    // Payment method attach + snapshot sync still run.
    expect(mocks.customersUpdate).toHaveBeenCalled();
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalled();
  });

  test("returns 200 on a successful upgrade", async () => {
    mocks.applyPendingUpgradeFromSetupCheckout.mockResolvedValue(true);

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(200);
    expect(mocks.applyPendingUpgradeFromSetupCheckout).toHaveBeenCalledWith({
      organizationId: "org_1",
      customerId: "cus_1",
      targetPlan: "pro",
      targetInterval: "monthly",
    });
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  test("still 500s when the snapshot sync fails (retryable)", async () => {
    mocks.applyPendingUpgradeFromSetupCheckout.mockResolvedValue(true);
    mocks.syncOrganizationBillingFromStripe.mockRejectedValue(new Error("transient"));

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(500);
  });
});
