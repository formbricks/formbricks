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
  sendBillingRequest(POST, "setup-checkout-sessions", { body: {}, ...options });

const RETURN_URL = `https://app.formbricks.com/organizations/${ORG_ID}/settings/billing`;

beforeEach(() => {
  resetBillingMocks();
  mocks.createSetupCheckoutSession.mockResolvedValue("https://checkout.stripe.test/setup");
});

describe("POST /api/internal/organizations/{organizationId}/billing/setup-checkout-sessions", () => {
  test("forwards the upgrade intent and the intent's key to the setup checkout", async () => {
    const response = await send({ body: { targetPlan: "pro", targetInterval: "yearly" } });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ url: "https://checkout.stripe.test/setup" });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.createSetupCheckoutSession).toHaveBeenCalledWith(
      "cus_1",
      "sub_1",
      RETURN_URL,
      ORG_ID,
      { targetPlan: "pro", targetInterval: "yearly" },
      `setup-checkout:${ORG_ID}:${INTENT_KEY}`
    );
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
      newObject: { setupCheckoutCreated: true, targetPlan: "pro", targetInterval: "yearly" },
    });
  });

  test("defaults the upgrade interval to monthly", async () => {
    await send({ body: { targetPlan: "scale" } });
    expect(mocks.createSetupCheckoutSession.mock.calls[0][4]).toEqual({
      targetPlan: "scale",
      targetInterval: "monthly",
    });
  });

  test("creates a payment-only setup checkout without an upgrade intent", async () => {
    await send();

    expect(mocks.createSetupCheckoutSession).toHaveBeenCalledWith(
      "cus_1",
      "sub_1",
      RETURN_URL,
      ORG_ID,
      undefined,
      `setup-checkout:${ORG_ID}:${INTENT_KEY}`
    );
    expect(queuedAudit()).toMatchObject({ newObject: { setupCheckoutCreated: true } });
  });

  test("answers the uniform 403 for an organization without a subscription", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({ subscriptionId: null }));
    expect((await send()).status).toBe(403);
    expect(mocks.createSetupCheckoutSession).not.toHaveBeenCalled();
  });

  test("answers 400 without an Idempotency-Key", async () => {
    expect((await send({ intentKey: null })).status).toBe(400);
  });

  test("refuses a caller who can't manage billing", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
    expect(mocks.createSetupCheckoutSession).not.toHaveBeenCalled();
  });
});
