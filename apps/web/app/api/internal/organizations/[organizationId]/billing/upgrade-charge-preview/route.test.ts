import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  ORG_ID,
  billingOrganization,
  billingMocks as mocks,
  operationLimits,
  resetBillingMocks,
  sendBillingRequest,
} from "../route-test.mock";
import { GET } from "./route";

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

const send = (query = "?targetPlan=scale&targetInterval=monthly") =>
  sendBillingRequest(GET, "upgrade-charge-preview", { method: "GET", query, intentKey: null });

beforeEach(() => {
  resetBillingMocks();
  mocks.previewImmediateUpgradeCharge.mockResolvedValue({ amountDue: 8900, currency: "usd" });
});

describe("GET /api/internal/organizations/{organizationId}/billing/upgrade-charge-preview", () => {
  test("answers the charge, charging no operation budget and auditing nothing", async () => {
    const response = await send();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ amountDue: 8900, currency: "usd" });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.previewImmediateUpgradeCharge).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      customerId: "cus_1",
      targetPlan: "scale",
      targetInterval: "monthly",
    });
    expect(operationLimits()).toEqual([]);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
    expect(mocks.withOrganizationBillingLock).not.toHaveBeenCalled();
  });

  test("answers null when Stripe can't price it", async () => {
    mocks.previewImmediateUpgradeCharge.mockResolvedValue(null);
    expect((await (await send()).json()).data).toBeNull();
  });

  test("answers the uniform 403 for an organization without a subscription", async () => {
    mocks.previewImmediateUpgradeCharge.mockRejectedValue(new ResourceNotFoundError("subscription", ORG_ID));
    expect((await send()).status).toBe(403);
  });

  test("answers the uniform 403 for an organization without a Stripe customer", async () => {
    mocks.getOrganization.mockResolvedValue(billingOrganization({}, null));
    expect((await send()).status).toBe(403);
  });

  test("rejects an unknown query parameter", async () => {
    expect((await send("?targetPlan=scale&targetInterval=monthly&extra=1")).status).toBe(400);
  });
});
