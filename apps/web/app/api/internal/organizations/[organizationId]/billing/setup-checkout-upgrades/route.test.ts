import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
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

const send = (body: unknown = { checkoutSessionId: "cs_1" }) =>
  sendBillingRequest(POST, "setup-checkout-upgrades", { body, intentKey: null });

beforeEach(() => {
  resetBillingMocks();
  mocks.applySetupCheckoutUpgrade.mockResolvedValue({
    mode: "immediate",
    clientSecret: null,
    requiresAction: false,
    targetPlan: "pro",
  });
});

describe("POST /api/internal/organizations/{organizationId}/billing/setup-checkout-upgrades", () => {
  test("finalizes the upgrade under the billing lock, syncs, and audits it", async () => {
    const response = await send();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      mode: "immediate",
      clientSecret: null,
      requiresAction: false,
      targetPlan: "pro",
    });
    expect(operationLimits()).toEqual([STATE_MUTATION]);
    expect(mocks.withOrganizationBillingLock).toHaveBeenCalledWith(
      ORG_ID,
      expect.any(Function),
      expect.anything()
    );
    expect(mocks.applySetupCheckoutUpgrade).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      checkoutSessionId: "cs_1",
    });
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith(ORG_ID);
    expect(queuedAudit()).toMatchObject({
      action: "subscriptionAccessed",
      organizationId: ORG_ID,
      targetId: ORG_ID,
      status: "success",
      newObject: { targetPlan: "pro", mode: "immediate" },
    });
  });

  test("skips the sync while 3D Secure is pending", async () => {
    mocks.applySetupCheckoutUpgrade.mockResolvedValue({
      mode: "immediate",
      clientSecret: "pi_secret",
      requiresAction: true,
      targetPlan: "scale",
    });

    expect((await (await send()).json()).data).toMatchObject({
      clientSecret: "pi_secret",
      requiresAction: true,
    });
    expect(mocks.syncOrganizationBillingFromStripe).not.toHaveBeenCalled();
  });

  test("refuses another organization's checkout with the reason", async () => {
    mocks.applySetupCheckoutUpgrade.mockRejectedValue(
      new OperationNotAllowedError("checkout_session_mismatch")
    );

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("checkout_session_mismatch");
  });

  test("answers 409 while another billing change holds the lock", async () => {
    mocks.withOrganizationBillingLock.mockResolvedValue({ ran: false });
    expect((await send()).status).toBe(409);
    expect(mocks.applySetupCheckoutUpgrade).not.toHaveBeenCalled();
  });

  test("rejects a missing checkout session id", async () => {
    expect((await send({})).status).toBe(400);
  });
});
