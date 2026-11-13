/**
 * Shared mocks for the billing route tests. Each test file registers them with `vi.mock(path, () =>
 * import("../route-test.mock").then((m) => m.billingModules.<name>))`, so every route is driven through the
 * real wrapper, auth and refusal mapping with Stripe and the billing service mocked at their boundary.
 */
import { NextRequest } from "next/server";
import { vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

export const ORG_ID = "clorg11111111111111111111";
export const USER_ID = "cluser1111111111111111111";
export const INTENT_KEY = "6f1c2b9e-3d4a-4c8b-9e2f-1a2b3c4d5e6f";

export const billingMocks = {
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getOrganization: vi.fn(),
  capturePostHogEvent: vi.fn(),
  withOrganizationBillingLock: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  createSetupCheckoutSession: vi.fn(),
  addOptimisticBillingFeature: vi.fn(),
  applySetupCheckoutUpgrade: vi.fn(),
  createPaidPlanCheckoutSession: vi.fn(),
  createProTrialSubscription: vi.fn(),
  ensureCloudStripeSetupForOrganization: vi.fn(),
  ensureStripeCustomerForOrganization: vi.fn(),
  getProTrialDays: vi.fn(),
  previewImmediateUpgradeCharge: vi.fn(),
  reconcileCloudStripeSubscriptionsForOrganization: vi.fn(),
  setOrganizationPaymentAttemptError: vi.fn(),
  switchOrganizationToCloudPlan: vi.fn(),
  syncOrganizationBillingFromStripe: vi.fn(),
  syncOrganizationBillingFromStripeExclusively: vi.fn(),
  undoPendingOrganizationPlanChange: vi.fn(),
};

const m = billingMocks;

export const billingModules = {
  authorization: { can: m.can },
  session: { getSession: m.getSession },
  v1Auth: { authenticateRequest: vi.fn() },
  rateLimitHelpers: { applyRateLimit: m.applyRateLimit },
  auditHandler: { queueAuditEvent: m.queueAuditEvent },
  apiLogging: {
    buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
      action,
      targetType,
      status: "failure",
    })),
  },
  logger: {
    logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
  },
  organizationService: { getOrganization: m.getOrganization },
  posthog: { capturePostHogEvent: m.capturePostHogEvent },
  billingLock: {
    BILLING_CHANGE_LOCK_TTL_MS: 120_000,
    BILLING_CHANGE_LOCK_WAIT_MS: 10_000,
    withOrganizationBillingLock: m.withOrganizationBillingLock,
  },
  portalSession: { createCustomerPortalSession: m.createCustomerPortalSession },
  setupCheckoutSession: { createSetupCheckoutSession: m.createSetupCheckoutSession },
  organizationBilling: {
    addOptimisticBillingFeature: m.addOptimisticBillingFeature,
    applySetupCheckoutUpgrade: m.applySetupCheckoutUpgrade,
    createPaidPlanCheckoutSession: m.createPaidPlanCheckoutSession,
    createProTrialSubscription: m.createProTrialSubscription,
    ensureCloudStripeSetupForOrganization: m.ensureCloudStripeSetupForOrganization,
    ensureStripeCustomerForOrganization: m.ensureStripeCustomerForOrganization,
    getProTrialDays: m.getProTrialDays,
    previewImmediateUpgradeCharge: m.previewImmediateUpgradeCharge,
    reconcileCloudStripeSubscriptionsForOrganization: m.reconcileCloudStripeSubscriptionsForOrganization,
    setOrganizationPaymentAttemptError: m.setOrganizationPaymentAttemptError,
    switchOrganizationToCloudPlan: m.switchOrganizationToCloudPlan,
    syncOrganizationBillingFromStripe: m.syncOrganizationBillingFromStripe,
    syncOrganizationBillingFromStripeExclusively: m.syncOrganizationBillingFromStripeExclusively,
    undoPendingOrganizationPlanChange: m.undoPendingOrganizationPlanChange,
  },
};

/** An organization with a Stripe customer, a subscription and a card on file, unless overridden. */
export const billingOrganization = (
  stripe: Record<string, unknown> = {},
  stripeCustomerId: string | null = "cus_1"
) => ({
  id: ORG_ID,
  billing: {
    stripeCustomerId,
    stripe: { subscriptionId: "sub_1", hasPaymentMethod: true, ...stripe },
  },
});

/** The defaults every billing route test starts from: an authorized session, budget and lock to spare. */
export const resetBillingMocks = () => {
  vi.clearAllMocks();
  m.getSession.mockResolvedValue({ user: { id: USER_ID } });
  m.can.mockResolvedValue(true);
  m.applyRateLimit.mockResolvedValue(undefined);
  m.getOrganization.mockResolvedValue(billingOrganization());
  m.withOrganizationBillingLock.mockImplementation(async (_organizationId: string, work: () => unknown) => ({
    ran: true,
    value: await work(),
  }));
  m.syncOrganizationBillingFromStripe.mockResolvedValue(null);
};

type TSendOptions = {
  method?: "GET" | "POST" | "DELETE";
  query?: string;
  body?: unknown;
  intentKey?: string | null;
  headers?: Record<string, string>;
  organizationId?: string;
};

type TRouteHandler = (req: NextRequest, props: never) => Promise<Response>;

/** Call a billing route the way the billing page does: same-origin, JSON, with an intent key by default. */
export const sendBillingRequest = (
  handler: TRouteHandler,
  resource: string,
  {
    method = "POST",
    query = "",
    body,
    intentKey = INTENT_KEY,
    headers = {},
    organizationId = ORG_ID,
  }: TSendOptions = {}
) =>
  handler(
    new NextRequest(
      `http://localhost/api/internal/organizations/${organizationId}/billing/${resource}${query}`,
      {
        method,
        headers: {
          ...SAME_ORIGIN_HEADERS,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(intentKey === null ? {} : { "Idempotency-Key": `"${intentKey}"` }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    ),
    { params: Promise.resolve({ organizationId }) } as never
  );

/** The operation budgets charged, beside the wrapper's per-user v3 limit: `[namespace, identifier]`. */
export const operationLimits = () =>
  m.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

/** The one audit entry the request queued. */
export const queuedAudit = () => {
  expectOneCall(m.queueAuditEvent);
  return m.queueAuditEvent.mock.calls[0][0] as Record<string, unknown>;
};

const expectOneCall = (mock: { mock: { calls: unknown[][] } }) => {
  if (mock.mock.calls.length !== 1) {
    throw new Error(`expected one audit entry, got ${mock.mock.calls.length}`);
  }
};

export const STATE_MUTATION = [rateLimitConfigs.actions.stateMutation.namespace, ORG_ID];
