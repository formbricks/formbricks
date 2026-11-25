import Stripe from "stripe";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ORG_ID,
  STATE_MUTATION,
  billingOrganization,
  billingMocks as mocks,
  operationLimits,
  queuedAudit,
  resetBillingMocks,
  sendBillingRequest,
} from "../route-test.mock";
import { POST } from "./route";

const support = vi.hoisted(() => () => import("../route-test.mock"));
const stripeMocks = vi.hoisted(() => ({ paymentIntentsRetrieve: vi.fn(), configured: true }));

// Stripe at its boundary: the route asks it about the payment intent the page sends. `configured: false`
// stands for an instance without a Stripe key, whose client is null.
vi.mock("@/modules/ee/billing/lib/stripe-client", () => ({
  get stripeClient() {
    return stripeMocks.configured
      ? { paymentIntents: { retrieve: stripeMocks.paymentIntentsRetrieve } }
      : null;
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", async () => (await support()).billingModules.authorization);
vi.mock("@/modules/auth/lib/session", async () => (await support()).billingModules.session);
vi.mock("@/app/api/v1/auth", async () => (await support()).billingModules.v1Auth);
vi.mock("@/modules/core/rate-limit/helpers", async () => (await support()).billingModules.rateLimitHelpers);
vi.mock("@/modules/ee/audit-logs/lib/handler", async () => (await support()).billingModules.auditHandler);
vi.mock("@/app/lib/api/with-api-logging", async () => (await support()).billingModules.apiLogging);
vi.mock("@formbricks/logger", async () => (await support()).billingModules.logger);
vi.mock("@/lib/organization/service", async () => (await support()).billingModules.organizationService);
vi.mock("@/lib/posthog", async () => (await support()).billingModules.posthog);
vi.mock("@/modules/ee/billing/lib/billing-lock", async () => (await support()).billingModules.billingLock);
vi.mock(
  "@/modules/ee/billing/api/lib/create-customer-portal-session",
  async () => (await support()).billingModules.portalSession
);
vi.mock(
  "@/modules/ee/billing/api/lib/create-setup-checkout-session",
  async () => (await support()).billingModules.setupCheckoutSession
);
vi.mock(
  "@/modules/ee/billing/lib/organization-billing",
  async () => (await support()).billingModules.organizationBilling
);
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://app.formbricks.com",
}));

const send = (body: unknown = { paymentIntentId: "pi_1" }) =>
  sendBillingRequest(POST, "payment-issues", { body, intentKey: null });

/** A payment intent as Stripe returns it, owned by the organization's customer and awaiting 3D Secure. */
const paymentIntent = (overrides: Partial<Stripe.PaymentIntent> = {}) =>
  ({
    id: "pi_1",
    object: "payment_intent",
    customer: "cus_1",
    status: "requires_action",
    ...overrides,
  }) as Stripe.PaymentIntent;

const stripeResourceMissing = () =>
  new Stripe.errors.StripeInvalidRequestError({
    type: "invalid_request_error",
    code: "resource_missing",
    message: "No such payment_intent: 'pi_1'",
  });

beforeEach(() => {
  resetBillingMocks();
  stripeMocks.configured = true;
  stripeMocks.paymentIntentsRetrieve.mockResolvedValue(paymentIntent());
});

describe("POST /api/internal/organizations/{organizationId}/billing/payment-issues", () => {
  test.each(["requires_action", "requires_payment_method"] as const)(
    "records an abandoned authentication of the organization's own payment intent (%s), and audits it",
    async (status) => {
      stripeMocks.paymentIntentsRetrieve.mockResolvedValue(paymentIntent({ status }));

      const response = await send();

      expect(response.status).toBe(204);
      expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage_billing", {
        type: "organization",
        id: ORG_ID,
      });
      expect(operationLimits()).toEqual([STATE_MUTATION]);
      expect(stripeMocks.paymentIntentsRetrieve).toHaveBeenCalledWith("pi_1");
      expect(mocks.setOrganizationPaymentAttemptError).toHaveBeenCalledWith(ORG_ID, {
        type: "requires_action",
        paymentIntentId: "pi_1",
        message: "Payment authentication was not completed. Please try again or contact support.",
        createdAt: expect.any(String),
      });
      expect(mocks.withOrganizationBillingLock).not.toHaveBeenCalled();
      expect(queuedAudit()).toMatchObject({
        action: "subscriptionAccessed",
        organizationId: ORG_ID,
        targetId: ORG_ID,
        status: "success",
        newObject: { paymentAttemptError: "requires_action" },
      });
    }
  );

  test("records the intent when Stripe returns its customer expanded", async () => {
    stripeMocks.paymentIntentsRetrieve.mockResolvedValue(
      paymentIntent({ customer: { id: "cus_1", object: "customer" } as Stripe.Customer })
    );

    expect((await send()).status).toBe(204);
    expect(mocks.setOrganizationPaymentAttemptError).toHaveBeenCalledOnce();
  });

  test.each([
    ["belongs to another customer", { customer: "cus_other" }],
    ["has no customer", { customer: null }],
    ["already succeeded", { status: "succeeded" }],
    ["is processing", { status: "processing" }],
    ["was canceled", { status: "canceled" }],
  ] as const)("ignores a payment intent that %s", async (_case, overrides) => {
    stripeMocks.paymentIntentsRetrieve.mockResolvedValue(paymentIntent(overrides));

    const response = await send();

    // The same answer as a recorded one, so the route tells nobody whether an id exists elsewhere.
    expect(response.status).toBe(204);
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
    expect(queuedAudit()).toMatchObject({ status: "success" });
    expect(queuedAudit().newObject).toBeUndefined();
  });

  test("ignores a payment intent Stripe doesn't know", async () => {
    stripeMocks.paymentIntentsRetrieve.mockRejectedValue(stripeResourceMissing());

    expect((await send()).status).toBe(204);
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
  });

  test("lets any other Stripe failure through, recording nothing", async () => {
    stripeMocks.paymentIntentsRetrieve.mockRejectedValue(
      new Stripe.errors.StripeConnectionError({ type: "api_error", message: "socket hang up" })
    );

    expect((await send()).status).toBe(500);
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
  });

  test("records nothing when Stripe isn't configured", async () => {
    stripeMocks.configured = false;

    expect((await send()).status).toBe(204);
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
    expect(queuedAudit().newObject).toBeUndefined();
  });

  test("refuses an organization with no Stripe customer, asking Stripe nothing", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({}, null));

    expect((await send()).status).toBe(403);
    expect(stripeMocks.paymentIntentsRetrieve).not.toHaveBeenCalled();
    expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
  });

  test.each([{ paymentIntentId: "" }, { paymentIntentId: "p".repeat(256) }, {}])(
    "rejects the body %o",
    async (body) => {
      expect((await send(body)).status).toBe(400);
      expect(mocks.setOrganizationPaymentAttemptError).not.toHaveBeenCalled();
    }
  );

  test("refuses a caller who can't manage billing", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
  });
});
