import { beforeEach, describe, expect, test } from "vitest";
import { vi } from "vitest";
import { OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import {
  INTENT_KEY,
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

const send = (options: Parameters<typeof sendBillingRequest>[2] = {}) =>
  sendBillingRequest(POST, "plan-changes", {
    body: { targetPlan: "scale", targetInterval: "monthly" },
    ...options,
  });

beforeEach(() => {
  resetBillingMocks();
  mocks.switchOrganizationToCloudPlan.mockResolvedValue({
    mode: "immediate",
    pendingChange: null,
    clientSecret: null,
    requiresAction: false,
  });
});

describe("POST /api/internal/organizations/{organizationId}/billing/plan-changes", () => {
  test("switches the plan under the billing lock with the intent's key, syncs, audits and answers the result", async () => {
    const response = await send();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      mode: "immediate",
      pendingChange: null,
      clientSecret: null,
      requiresAction: false,
    });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.withOrganizationBillingLock).toHaveBeenCalledWith(ORG_ID, expect.any(Function), {
      ttlMs: 120_000,
      waitMs: 10_000,
    });
    expect(mocks.switchOrganizationToCloudPlan).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      customerId: "cus_1",
      targetPlan: "scale",
      targetInterval: "monthly",
      idempotencyKey: `plan-change:${ORG_ID}:${INTENT_KEY}`,
    });
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith(ORG_ID);
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      targetType: "organization",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      userId: USER_ID,
      status: "success",
      newObject: { targetPlan: "scale", targetInterval: "monthly", mode: "immediate" },
    });
  });

  test("takes a bare UUID as the key too", async () => {
    await send({ headers: { "Idempotency-Key": INTENT_KEY } });
    expect(mocks.switchOrganizationToCloudPlan).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `plan-change:${ORG_ID}:${INTENT_KEY}` })
    );
  });

  test.each([
    ["missing", null],
    ["not a UUID", "click-1"],
    ["too long", "a".repeat(100)],
  ])("answers 400 without touching Stripe when the Idempotency-Key is %s", async (_case, intentKey) => {
    const response = await send({ intentKey });

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      { name: "Idempotency-Key", reason: "Expected a UUID" },
    ]);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.switchOrganizationToCloudPlan).not.toHaveBeenCalled();
  });

  test("skips the sync while 3D Secure is pending, and hands the client secret back", async () => {
    mocks.switchOrganizationToCloudPlan.mockResolvedValue({
      mode: "immediate",
      pendingChange: null,
      clientSecret: "pi_secret",
      requiresAction: true,
    });

    const response = await send();

    expect((await response.json()).data).toMatchObject({ clientSecret: "pi_secret", requiresAction: true });
    expect(mocks.syncOrganizationBillingFromStripe).not.toHaveBeenCalled();
  });

  test("answers a scheduled downgrade with its pending change and leaves the resync to the webhook", async () => {
    const pendingChange = {
      type: "plan_change",
      targetPlan: "hobby",
      targetInterval: "monthly",
      effectiveAt: "2026-12-01T00:00:00.000Z",
    };
    mocks.switchOrganizationToCloudPlan.mockResolvedValue({ mode: "scheduled", pendingChange });

    const response = await send({ body: { targetPlan: "hobby", targetInterval: "monthly" } });

    expect((await response.json()).data).toEqual({
      mode: "scheduled",
      pendingChange,
      clientSecret: null,
      requiresAction: false,
    });
    expect(mocks.syncOrganizationBillingFromStripe).not.toHaveBeenCalled();
  });

  test("refuses a paid change without a payment method, with the reason the page translates", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({ hasPaymentMethod: false }));

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("payment_method_required");
    expect(mocks.switchOrganizationToCloudPlan).not.toHaveBeenCalled();
    expect(queuedAudit()).toMatchObject({ status: "failure", organizationId: ORG_ID, targetId: ORG_ID });
  });

  test("lets a no-card organization go back to Hobby", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({ hasPaymentMethod: false }));
    expect((await send({ body: { targetPlan: "hobby", targetInterval: "monthly" } })).status).toBe(200);
  });

  test("answers the billing service's refusal with its reason", async () => {
    mocks.switchOrganizationToCloudPlan.mockRejectedValue(
      new OperationNotAllowedError("billing_currency_conflict")
    );

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("billing_currency_conflict");
  });

  test("answers 409 while another billing change holds the lock", async () => {
    mocks.withOrganizationBillingLock.mockResolvedValue({ ran: false });

    const response = await send();

    expect(response.status).toBe(409);
    expect(mocks.switchOrganizationToCloudPlan).not.toHaveBeenCalled();
  });

  test.each([
    ["is gone", null],
    ["has no Stripe customer", billingOrganization({}, null)],
  ])("answers the uniform 403 for an organization that %s", async (_case, organization) => {
    mocks.getOrganization.mockResolvedValue(organization);

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("refuses a caller who can't manage billing, before any budget or Stripe call", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await send()).status).toBe(403);
    expect(operationLimits()).toEqual([]);
    expect(mocks.switchOrganizationToCloudPlan).not.toHaveBeenCalled();
  });

  test("answers 429 once the organization's state-mutation budget is spent", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === STATE_MUTATION[0]) throw new TooManyRequestsError("Too many requests", 60);
    });

    expect((await send()).status).toBe(429);
    expect(mocks.switchOrganizationToCloudPlan).not.toHaveBeenCalled();
  });

  test.each([
    { targetPlan: "hobby", targetInterval: "yearly" },
    { targetPlan: "enterprise", targetInterval: "monthly" },
    { targetPlan: "pro", targetInterval: "monthly", organizationId: ORG_ID },
  ])("rejects the body %o", async (body) => {
    expect((await send({ body })).status).toBe(400);
  });
});
