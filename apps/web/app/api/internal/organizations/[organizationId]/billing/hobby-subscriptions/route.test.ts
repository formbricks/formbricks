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

const send = () => sendBillingRequest(POST, "hobby-subscriptions", { intentKey: null });

beforeEach(() => {
  resetBillingMocks();
  mocks.getOrganization.mockResolvedValue(billingOrganization({}, null));
  mocks.ensureStripeCustomerForOrganization.mockResolvedValue({ customerId: "cus_1" });
});

describe("POST /api/internal/organizations/{organizationId}/billing/hobby-subscriptions", () => {
  test("ensures a customer, reconciles Hobby, syncs, and reports the choice", async () => {
    const response = await send();

    expect(response.status).toBe(204);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.withOrganizationBillingLock).toHaveBeenCalledWith(
      ORG_ID,
      expect.any(Function),
      expect.anything()
    );
    expect(mocks.getOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.ensureStripeCustomerForOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "stayed_on_hobby_plan",
      { organization_id: ORG_ID },
      { organizationId: ORG_ID }
    );
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
      newObject: { plan: "hobby" },
    });
  });

  test("reuses an existing Stripe customer", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({}, "cus_existing"));

    expect((await send()).status).toBe(204);
    expect(mocks.ensureStripeCustomerForOrganization).not.toHaveBeenCalled();
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith(ORG_ID);
  });

  test("answers the uniform 403 when no customer can be had", async () => {
    mocks.ensureStripeCustomerForOrganization.mockResolvedValue({ customerId: null });
    expect((await send()).status).toBe(403);
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for an organization that is gone", async () => {
    mocks.getOrganization.mockResolvedValue(null);
    expect((await send()).status).toBe(403);
  });

  test("refuses a billing-only member, who can't manage the organization", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("answers 409 while another billing change holds the lock", async () => {
    mocks.withOrganizationBillingLock.mockResolvedValue({ ran: false });
    expect((await send()).status).toBe(409);
  });
});
