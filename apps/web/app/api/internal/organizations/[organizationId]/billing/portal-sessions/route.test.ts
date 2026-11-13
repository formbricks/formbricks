import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ORG_ID,
  STATE_MUTATION,
  USER_ID,
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

const send = () => sendBillingRequest(POST, "portal-sessions", { intentKey: null });

beforeEach(() => {
  resetBillingMocks();
  mocks.createCustomerPortalSession.mockResolvedValue("https://billing.stripe.test/session");
});

describe("POST /api/internal/organizations/{organizationId}/billing/portal-sessions", () => {
  test("opens a portal session returning to the billing settings, and audits it", async () => {
    const response = await send();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ url: "https://billing.stripe.test/session" });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.createCustomerPortalSession).toHaveBeenCalledWith(
      "cus_1",
      `https://app.formbricks.com/organizations/${ORG_ID}/settings/billing`
    );
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      targetType: "organization",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
      newObject: { portalSessionCreated: true },
    });
  });

  test("answers the uniform 403 for an organization without a Stripe customer", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({}, null));

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.createCustomerPortalSession).not.toHaveBeenCalled();
  });

  test("refuses a caller who can't manage billing", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
    expect(mocks.createCustomerPortalSession).not.toHaveBeenCalled();
    expect(queuedAudit()).toMatchObject({ status: "failure", organizationId: ORG_ID });
  });
});
