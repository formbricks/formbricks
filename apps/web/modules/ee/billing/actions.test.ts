import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTrialPaymentCheckoutAction, startHobbyAction, startProTrialAction } from "./actions";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspace: vi.fn(),
  createProTrialSubscription: vi.fn(),
  ensureCloudStripeSetupForOrganization: vi.fn(),
  ensureStripeCustomerForOrganization: vi.fn(),
  reconcileCloudStripeSubscriptionsForOrganization: vi.fn(),
  syncOrganizationBillingFromStripe: vi.fn(),
  addOptimisticBillingFeature: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  createSetupCheckoutSession: vi.fn(),
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
  POSTHOG_KEY: undefined,
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: mocks.getWorkspace,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/billing/api/lib/create-customer-portal-session", () => ({
  createCustomerPortalSession: mocks.createCustomerPortalSession,
}));

vi.mock("@/modules/ee/billing/api/lib/create-setup-checkout-session", () => ({
  createSetupCheckoutSession: mocks.createSetupCheckoutSession,
}));

vi.mock("@/modules/ee/billing/api/lib/is-subscription-cancelled", () => ({
  isSubscriptionCancelled: mocks.isSubscriptionCancelled,
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  createProTrialSubscription: mocks.createProTrialSubscription,
  ensureCloudStripeSetupForOrganization: mocks.ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization: mocks.ensureStripeCustomerForOrganization,
  reconcileCloudStripeSubscriptionsForOrganization: mocks.reconcileCloudStripeSubscriptionsForOrganization,
  syncOrganizationBillingFromStripe: mocks.syncOrganizationBillingFromStripe,
  addOptimisticBillingFeature: mocks.addOptimisticBillingFeature,
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
    mocks.createProTrialSubscription.mockResolvedValue(undefined);
    mocks.reconcileCloudStripeSubscriptionsForOrganization.mockResolvedValue(undefined);
    mocks.syncOrganizationBillingFromStripe.mockResolvedValue({ stripe: { features: ["ai-smart-tools"] } });
    mocks.addOptimisticBillingFeature.mockResolvedValue(undefined);
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
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith("org_1");
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
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith("org_1");
    expect(result).toEqual({ success: true });
  });

  test("startProTrialAction uses ensured customer when org snapshot has no stripe customer id", async () => {
    const result = await startProTrialAction({
      ctx: { user: { id: "user_1" } },
      parsedInput: { organizationId: "org_1" },
    } as any);

    expect(mocks.getOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.ensureStripeCustomerForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.createProTrialSubscription).toHaveBeenCalledWith("org_1", "cus_1");
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith("org_1");
    expect(mocks.addOptimisticBillingFeature).toHaveBeenCalledWith("org_1", "ai-smart-tools");
    expect(result).toEqual({ success: true });
  });

  test("startProTrialAction reuses an existing stripe customer id", async () => {
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      billing: {
        stripeCustomerId: "cus_existing",
      },
    });

    const result = await startProTrialAction({
      ctx: { user: { id: "user_1" } },
      parsedInput: { organizationId: "org_1" },
    } as any);

    expect(mocks.ensureStripeCustomerForOrganization).not.toHaveBeenCalled();
    expect(mocks.createProTrialSubscription).toHaveBeenCalledWith("org_1", "cus_existing");
    expect(mocks.reconcileCloudStripeSubscriptionsForOrganization).toHaveBeenCalledWith("org_1");
    expect(mocks.syncOrganizationBillingFromStripe).toHaveBeenCalledWith("org_1");
    expect(mocks.addOptimisticBillingFeature).toHaveBeenCalledWith("org_1", "ai-smart-tools");
    expect(result).toEqual({ success: true });
  });

  test("createTrialPaymentCheckoutAction forwards upgrade intent to setup checkout", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org_1");
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      billing: {
        stripeCustomerId: "cus_1",
        stripe: {
          subscriptionId: "sub_1",
        },
      },
    });
    mocks.getWorkspace.mockResolvedValue({ id: "ws_1" });
    mocks.createSetupCheckoutSession.mockResolvedValue("https://checkout.stripe.test/setup");

    const result = await createTrialPaymentCheckoutAction({
      ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
      parsedInput: {
        workspaceId: "ws_1",
        targetPlan: "pro",
        targetInterval: "yearly",
      },
    } as any);

    expect(mocks.createSetupCheckoutSession).toHaveBeenCalledWith(
      "cus_1",
      "sub_1",
      "https://app.formbricks.com/workspaces/ws_1/settings/organization/billing",
      "org_1",
      {
        targetPlan: "pro",
        targetInterval: "yearly",
      }
    );
    expect(result).toBe("https://checkout.stripe.test/setup");
  });

  test("createTrialPaymentCheckoutAction creates payment-only setup checkout without upgrade intent", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org_1");
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      billing: {
        stripeCustomerId: "cus_1",
        stripe: {
          subscriptionId: "sub_1",
        },
      },
    });
    mocks.getWorkspace.mockResolvedValue({ id: "ws_1" });
    mocks.createSetupCheckoutSession.mockResolvedValue("https://checkout.stripe.test/setup");

    await createTrialPaymentCheckoutAction({
      ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
      parsedInput: {
        workspaceId: "ws_1",
      },
    } as any);

    expect(mocks.createSetupCheckoutSession).toHaveBeenCalledWith(
      "cus_1",
      "sub_1",
      "https://app.formbricks.com/workspaces/ws_1/settings/organization/billing",
      "org_1",
      undefined
    );
  });
});
