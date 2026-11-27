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
import { DELETE } from "./route";

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

const send = () => sendBillingRequest(DELETE, "pending-plan-change", { method: "DELETE", intentKey: null });

beforeEach(() => {
  resetBillingMocks();
});

describe("DELETE /api/internal/organizations/{organizationId}/billing/pending-plan-change", () => {
  test("undoes the pending change and syncs, under the billing lock, and audits it", async () => {
    const response = await send();

    expect(response.status).toBe(204);
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.withOrganizationBillingLock).toHaveBeenCalledWith(
      ORG_ID,
      expect.any(Function),
      expect.anything()
    );
    expect(mocks.undoPendingOrganizationPlanChange).toHaveBeenCalledWith(ORG_ID, "cus_1");
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith(ORG_ID);
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
    });
  });

  test("answers the uniform 403 for an organization without a Stripe customer", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({}, null));
    expect((await send()).status).toBe(403);
    expect(mocks.undoPendingOrganizationPlanChange).not.toHaveBeenCalled();
  });

  test("answers 409 while another billing change holds the lock", async () => {
    mocks.withOrganizationBillingLock.mockResolvedValue({ ran: false });
    expect((await send()).status).toBe(409);
  });

  test("refuses a caller who can't manage billing", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
  });
});
