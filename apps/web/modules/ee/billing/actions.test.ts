import { beforeEach, describe, expect, test, vi } from "vitest";
import { startHobbyAction, startScaleTrialAction } from "./actions";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  getOrganization: vi.fn(),
  createScaleTrialSubscription: vi.fn(),
  ensureCloudStripeSetupForOrganization: vi.fn(),
  ensureStripeCustomerForOrganization: vi.fn(),
  reconcileCloudStripeSubscriptionsForOrganization: vi.fn(),
  syncOrganizationBillingFromStripe: vi.fn(),
  getOrganizationIdFromEnvironmentId: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  isSubscriptionCancelled: vi.fn(),
  stripeCustomerSessionsCreate: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "https://app.formbricks.com",
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromEnvironmentId: mocks.getOrganizationIdFromEnvironmentId,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/billing/api/lib/create-customer-portal-session", () => ({
  createCustomerPortalSession: mocks.createCustomerPortalSession,
}));

vi.mock("@/modules/ee/billing/api/lib/is-subscription-cancelled", () => ({
  isSubscriptionCancelled: mocks.isSubscriptionCancelled,
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  createScaleTrialSubscription: mocks.createScaleTrialSubscription,
  ensureCloudStripeSetupForOrganization: mocks.ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization: mocks.ensureStripeCustomerForOrganization,
  reconcileCloudStripeSubscriptionsForOrganization: mocks.reconcileCloudStripeSubscriptionsForOrganization,
  syncOrganizationBillingFromStripe: mocks.syncOrganizationBillingFromStripe,
}));

vi.mock("@/modules/ee/billing/lib/stripe-client", () => ({
  stripeClient: {
    customerSessions: {
      create: mocks.stripeCustomerSessionsCreate,
    },
  },
}));

describe("billing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      billing: {
        stripeCustomerId: null,
      },
    });
    mocks.ensureStripeCustomerForOrganization.mockResolvedValue({ customerId: "cus_1" });
    mocks.createScaleTrialSubscription.mockResolvedValue(undefined);
    mocks.reconcileCloudStripeSubscriptionsForOrganization.mockResolvedValue(undefined);
    mocks.syncOrganizationBillingFromStripe.mockResolvedValue(undefined);
  });

  test("startHobbyAction ensures a customer, reconciles hobby, and syncs billing", async () => {
    const result = await startHobbyAction({
      ctx: { user: { id: "user_1" } },
      parsedInput: { organizationId: "org_1" },
    } as any);

    expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "org_1",
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });
    expect(mocks.getOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.ensureStripeCustomerForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith(
      "org_1",
      "start-hobby"
    );
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith("org_1");
    expect(result).toEqual({ success: true });
  });

  test("startHobbyAction reuses an existing stripe customer id", async () => {
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      billing: {
        stripeCustomerId: "cus_existing",
      },
    });

    const result = await startHobbyAction({
      ctx: { user: { id: "user_1" } },
      parsedInput: { organizationId: "org_1" },
    } as any);

    expect(mocks.ensureStripeCustomerForOrganization).not.toHaveBeenCalled();
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith(
      "org_1",
      "start-hobby"
    );
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith("org_1");
    expect(result).toEqual({ success: true });
  });

  test("startScaleTrialAction uses ensured customer when org snapshot has no stripe customer id", async () => {
    const result = await startScaleTrialAction({
      ctx: { user: { id: "user_1" } },
      parsedInput: { organizationId: "org_1" },
    } as any);

    expect(mocks.getOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.ensureStripeCustomerForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.createScaleTrialSubscription).toHaveBeenCalledWith("org_1", "cus_1");
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith(
      "org_1",
      "scale-trial"
    );
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith("org_1");
    expect(result).toEqual({ success: true });
  });

  test("startScaleTrialAction reuses an existing stripe customer id", async () => {
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      billing: {
        stripeCustomerId: "cus_existing",
      },
    });

    const result = await startScaleTrialAction({
      ctx: { user: { id: "user_1" } },
      parsedInput: { organizationId: "org_1" },
    } as any);

    expect(mocks.ensureStripeCustomerForOrganization).not.toHaveBeenCalled();
    expect(mocks.createScaleTrialSubscription).toHaveBeenCalledWith("org_1", "cus_existing");
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith(
      "org_1",
      "scale-trial"
    );
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith("org_1");
    expect(result).toEqual({ success: true });
  });
});
