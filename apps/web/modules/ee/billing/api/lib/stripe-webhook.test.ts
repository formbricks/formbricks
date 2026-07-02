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
  setOrganizationPaymentAttemptError: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
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
  setOrganizationPaymentAttemptError: mocks.setOrganizationPaymentAttemptError,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
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

  test("attaches the saved card as default but does not apply the upgrade", async () => {
    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(200);
    // Card saved as default on both the customer (future invoices) and the subscription.
    expect(mocks.customersUpdate).toHaveBeenCalledWith("cus_1", {
      invoice_settings: { default_payment_method: "pm_1" },
    });
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith("sub_1", {
      default_payment_method: "pm_1",
    });
    // The prorated upgrade charge is intentionally NOT attempted from the webhook — it
    // may require on-session 3D Secure, so the billing page drives it after redirect.
    expect(mocks.applyPendingUpgradeFromSetupCheckout).not.toHaveBeenCalled();
    // Snapshot sync still runs and no error is logged.
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalled();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  test("still 500s when the snapshot sync fails (retryable)", async () => {
    mocks.syncOrganizationBillingFromStripe.mockRejectedValue(new Error("transient"));

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(500);
  });
});

const buildPaymentIntentEvent = (
  type: "payment_intent.requires_action" | "payment_intent.canceled",
  object: Partial<{ id: string; customer: unknown; status: string; cancellation_reason: string | null }>
) => ({
  id: "evt_pi",
  type,
  created: 1739923200,
  data: { object: { id: "pi_1", customer: "cus_1", ...object } },
});

describe("webhookHandler payment intent failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStripeClient.mockReturnValue(stripeClient);
    mocks.getStripeWebhookSecret.mockReturnValue("whsec_test");
    mocks.findOrganizationIdByStripeCustomerId.mockResolvedValue("org_1");
    mocks.setOrganizationPaymentAttemptError.mockResolvedValue(undefined);
  });

  test("records a requires_action error and skips the subscription sync", async () => {
    mocks.constructEvent.mockReturnValue(
      buildPaymentIntentEvent("payment_intent.requires_action", { status: "requires_action" })
    );

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(200);
    expect(mocks.setOrganizationPaymentAttemptError).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({ type: "requires_action", paymentIntentId: "pi_1" }),
      expect.objectContaining({ id: "evt_pi", created: 1739923200 })
    );
    // payment-intent events short-circuit before the full snapshot sync.
    expect(mocks.syncOrganizationBillingFromStripe).not.toHaveBeenCalled();
  });

  test("records a failed_invoice error when a payment is canceled for that reason", async () => {
    mocks.constructEvent.mockReturnValue(
      buildPaymentIntentEvent("payment_intent.canceled", {
        status: "canceled",
        cancellation_reason: "failed_invoice",
      })
    );

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(200);
    expect(mocks.setOrganizationPaymentAttemptError).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({ type: "failed_invoice", paymentIntentId: "pi_1" }),
      expect.objectContaining({ id: "evt_pi", created: 1739923200 })
    );
  });

  test("ignores a cancellation with a benign reason (no false error banner)", async () => {
    mocks.constructEvent.mockReturnValue(
      buildPaymentIntentEvent("payment_intent.canceled", {
        status: "canceled",
        cancellation_reason: "abandoned",
      })
    );

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(200);
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
  });

  test("ignores a payment intent with no string customer", async () => {
    mocks.constructEvent.mockReturnValue(
      buildPaymentIntentEvent("payment_intent.requires_action", { customer: null })
    );

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(200);
    expect(mocks.findOrganizationIdByStripeCustomerId).not.toHaveBeenCalled();
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
  });

  test("ignores a payment intent whose customer maps to no organization", async () => {
    mocks.findOrganizationIdByStripeCustomerId.mockResolvedValue(null);
    mocks.constructEvent.mockReturnValue(
      buildPaymentIntentEvent("payment_intent.canceled", {
        status: "canceled",
        cancellation_reason: "failed_invoice",
      })
    );

    const result = await webhookHandler("body", "sig");

    expect(result.status).toBe(200);
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
  });
});
