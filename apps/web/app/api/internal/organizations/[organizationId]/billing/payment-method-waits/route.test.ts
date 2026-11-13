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

const send = () => sendBillingRequest(POST, "payment-method-waits", { intentKey: null });

beforeEach(() => {
  resetBillingMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/internal/organizations/{organizationId}/billing/payment-method-waits", () => {
  test("answers as soon as a locked sync shows a payment method", async () => {
    mocks.syncOrganizationBillingFromStripeExclusively.mockResolvedValue({
      stripe: { hasPaymentMethod: true },
    });

    const response = await send();

    expect((await response.json()).data).toEqual({ hasPaymentMethod: true });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.syncOrganizationBillingFromStripeExclusively).toHaveBeenCalledTimes(1);
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
    });
  });

  test("gives up after five syncs", async () => {
    mocks.syncOrganizationBillingFromStripeExclusively.mockResolvedValue({
      stripe: { hasPaymentMethod: false },
    });

    const pending = send();
    await vi.advanceTimersByTimeAsync(4 * 1200);

    expect((await (await pending).json()).data).toEqual({ hasPaymentMethod: false });
    expect(mocks.syncOrganizationBillingFromStripeExclusively).toHaveBeenCalledTimes(5);
  });

  test("refuses a caller who can't manage billing", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
    expect(mocks.syncOrganizationBillingFromStripeExclusively).not.toHaveBeenCalled();
  });
});
