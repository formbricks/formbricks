import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  INTENT_KEY,
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

const send = (options: Parameters<typeof sendBillingRequest>[2] = {}) =>
  sendBillingRequest(POST, "checkout-sessions", {
    body: { targetPlan: "pro", targetInterval: "monthly" },
    ...options,
  });

beforeEach(() => {
  resetBillingMocks();
  mocks.getOrganization.mockResolvedValue(billingOrganization({ subscriptionId: null }));
  mocks.createPaidPlanCheckoutSession.mockResolvedValue("https://checkout.stripe.test/session");
});

describe("POST /api/internal/organizations/{organizationId}/billing/checkout-sessions", () => {
  test("creates the paid-plan checkout with the intent's key, and audits it", async () => {
    const response = await send();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ url: "https://checkout.stripe.test/session" });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.createPaidPlanCheckoutSession).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      customerId: "cus_1",
      plan: "pro",
      interval: "monthly",
      idempotencyKey: `plan-checkout:${ORG_ID}:${INTENT_KEY}`,
    });
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
      newObject: { checkoutCreated: true, targetPlan: "pro", targetInterval: "monthly" },
    });
  });

  test("sends the same key for a retry of the same intent", async () => {
    await send();
    await send();
    const [first, second] = mocks.createPaidPlanCheckoutSession.mock.calls.map(
      ([input]) => input.idempotencyKey
    );
    expect(second).toBe(first);
  });

  test("answers 400 without an Idempotency-Key", async () => {
    expect((await send({ intentKey: null })).status).toBe(400);
    expect(mocks.createPaidPlanCheckoutSession).not.toHaveBeenCalled();
  });

  test("refuses an organization that already has a subscription, with the reason", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({ subscriptionId: "sub_1" }));

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("paid_checkout_requires_no_existing_subscription");
    expect(mocks.createPaidPlanCheckoutSession).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for an organization without a Stripe customer", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({}, null));
    expect((await send()).status).toBe(403);
    expect(mocks.createPaidPlanCheckoutSession).not.toHaveBeenCalled();
  });

  test("rejects a Hobby or unknown target", async () => {
    expect((await send({ body: { targetPlan: "hobby", targetInterval: "monthly" } })).status).toBe(400);
  });
});
