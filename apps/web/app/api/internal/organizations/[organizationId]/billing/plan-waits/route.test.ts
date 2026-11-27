import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ORG_ID,
  STATE_MUTATION,
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

const send = (targetPlan = "pro") =>
  sendBillingRequest(POST, "plan-waits", { body: { targetPlan }, intentKey: null });

beforeEach(() => {
  resetBillingMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/internal/organizations/{organizationId}/billing/plan-waits", () => {
  test("answers as soon as one locked sync shows the plan, with one audit entry", async () => {
    mocks.syncOrganizationBillingFromStripeExclusively.mockResolvedValue({ stripe: { plan: "pro" } });

    const response = await send();

    expect((await response.json()).data).toEqual({ plan: "pro" });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.syncOrganizationBillingFromStripeExclusively).toHaveBeenCalledTimes(1);
    expect(mocks.syncOrganizationBillingFromStripeExclusively).toHaveBeenCalledWith(ORG_ID);
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
    });
  });

  test("resyncs up to five times, 1.2 s apart, and answers the last plan seen", async () => {
    mocks.syncOrganizationBillingFromStripeExclusively.mockResolvedValue({ stripe: { plan: "hobby" } });

    const pending = send();
    await vi.advanceTimersByTimeAsync(4 * 1200);
    const response = await pending;

    expect((await response.json()).data).toEqual({ plan: "hobby" });
    expect(mocks.syncOrganizationBillingFromStripeExclusively).toHaveBeenCalledTimes(5);
  });

  test("stops once a later sync shows the plan", async () => {
    mocks.syncOrganizationBillingFromStripeExclusively
      .mockResolvedValueOnce({ stripe: { plan: "hobby" } })
      .mockResolvedValue({ stripe: { plan: "scale" } });

    const pending = send("scale");
    await vi.advanceTimersByTimeAsync(1200);

    expect((await (await pending).json()).data).toEqual({ plan: "scale" });
    expect(mocks.syncOrganizationBillingFromStripeExclusively).toHaveBeenCalledTimes(2);
  });

  test("answers null without a Stripe snapshot", async () => {
    mocks.syncOrganizationBillingFromStripeExclusively.mockResolvedValue(null);
    const pending = send();
    await vi.advanceTimersByTimeAsync(4 * 1200);
    expect((await (await pending).json()).data).toEqual({ plan: null });
  });

  test("refuses a caller who can't manage billing, without syncing", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
    expect(mocks.syncOrganizationBillingFromStripeExclusively).not.toHaveBeenCalled();
  });

  test("rejects an unknown plan", async () => {
    expect((await send("enterprise")).status).toBe(400);
  });
});
