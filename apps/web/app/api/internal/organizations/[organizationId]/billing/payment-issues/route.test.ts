import { beforeEach, describe, expect, test, vi } from "vitest";
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

const send = (body: unknown = { paymentIntentId: "pi_1" }) =>
  sendBillingRequest(POST, "payment-issues", { body, intentKey: null });

beforeEach(() => {
  resetBillingMocks();
});

describe("POST /api/internal/organizations/{organizationId}/billing/payment-issues", () => {
  test("records the abandoned authentication, and audits it", async () => {
    const response = await send();

    expect(response.status).toBe(204);
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
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
