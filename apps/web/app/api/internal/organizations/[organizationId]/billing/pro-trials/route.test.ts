import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
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

const send = () => sendBillingRequest(POST, "pro-trials", { intentKey: null });

beforeEach(() => {
  resetBillingMocks();
  mocks.getOrganization.mockResolvedValue(billingOrganization({}, null));
  mocks.ensureStripeCustomerForOrganization.mockResolvedValue({ customerId: "cus_1" });
  mocks.getProTrialDays.mockResolvedValue(14);
  mocks.syncOrganizationBillingFromStripe.mockResolvedValue({ stripe: { features: ["ai-smart-tools"] } });
});

describe("POST /api/internal/organizations/{organizationId}/billing/pro-trials", () => {
  test("starts the trial on the ensured customer, under the billing lock, and audits it", async () => {
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
    expect(mocks.ensureStripeCustomerForOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.getProTrialDays).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.createProTrialSubscription).toHaveBeenCalledWith(ORG_ID, "cus_1", 14);
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.addOptimisticBillingFeature).toHaveBeenCalledWith(ORG_ID, "ai-smart-tools");
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "free_trial_started",
      { plan: "pro", organization_id: ORG_ID, trial_duration_days: 14 },
      { organizationId: ORG_ID }
    );
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
      newObject: { plan: "pro", trialDurationDays: 14 },
    });
  });

  test("passes the shortened trial length when the A/B test variant is active", async () => {
    mocks.getProTrialDays.mockResolvedValue(7);
    await send();
    expect(mocks.createProTrialSubscription).toHaveBeenCalledWith(ORG_ID, "cus_1", 7);
  });

  test("reports the trial end and length on reverse_trial_started", async () => {
    mocks.getProTrialDays.mockResolvedValue(7);
    mocks.syncOrganizationBillingFromStripe.mockResolvedValue({
      stripe: { trialEnd: "2026-10-07T12:00:00.000Z" },
    });

    await send();

    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "reverse_trial_started",
      { organization_id: ORG_ID, trial_end: "2026-10-07T12:00:00.000Z", trial_duration_days: 7 },
      { organizationId: ORG_ID }
    );
  });

  test("reports a null trial end when the sync has none", async () => {
    await send();
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "reverse_trial_started",
      { organization_id: ORG_ID, trial_end: null, trial_duration_days: 14 },
      { organizationId: ORG_ID }
    );
  });

  test("reuses an existing Stripe customer", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({}, "cus_existing"));

    await send();

    expect(mocks.ensureStripeCustomerForOrganization).not.toHaveBeenCalled();
    expect(mocks.createProTrialSubscription).toHaveBeenCalledWith(ORG_ID, "cus_existing", 14);
  });

  test("refuses a second trial with the reason the page translates", async () => {
    mocks.createProTrialSubscription.mockRejectedValue(new OperationNotAllowedError("trial_already_used"));

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("trial_already_used");
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
    expect(queuedAudit()).toMatchObject({ status: "failure", organizationId: ORG_ID });
  });

  test("refuses a caller who can't manage the organization, before the budget", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
    expect(operationLimits()).toEqual([]);
    expect(mocks.createProTrialSubscription).not.toHaveBeenCalled();
  });

  test("answers 409 while another billing change holds the lock", async () => {
    mocks.withOrganizationBillingLock.mockResolvedValue({ ran: false });
    expect((await send()).status).toBe(409);
    expect(mocks.createProTrialSubscription).not.toHaveBeenCalled();
  });
});
