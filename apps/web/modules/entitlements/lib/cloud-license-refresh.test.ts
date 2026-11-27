// ENG-7563. A Cloud organization's paid entitlement across a failed license refresh, through the real
// license client (fetch, Redis caching, grace logic), the real Cloud provider and the real guard. The
// unit tests in checks.test.ts build the grace context by hand; this one proves the guard accepts the
// shape license.ts actually produces. Only the module boundaries are faked: the license server
// (global fetch), Redis (an in-memory TTL store), Prisma, the instance id and the Stripe snapshot.
import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { hasOrganizationEntitlementWithLicenseGuard } from "./checks";

const { store, cache } = vi.hoisted(() => {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  const read = (key: string) => {
    const entry = store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) return undefined;
    return entry;
  };
  const cache = {
    get: async (key: string) => ({ ok: true, data: read(key)?.value ?? null }),
    set: async (key: string, value: unknown, ttl: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttl });
      return { ok: true, data: undefined };
    },
    tryLock: async (key: string, value: unknown, ttl: number) => {
      if (read(key)) return { ok: true, data: false };
      store.set(key, { value, expiresAt: Date.now() + ttl });
      return { ok: true, data: true };
    },
  };
  return { store, cache };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { ENTERPRISE_LICENSE_KEY: "cloud-license-key", ENVIRONMENT: "production", NODE_ENV: "test" },
}));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  IS_FORMBRICKS_CLOUD: true,
  E2E_TESTING: false,
}));
vi.mock("@/lib/cache", () => ({ cache }));
vi.mock("@/lib/instance", () => ({ getInstanceId: async () => "instance-1" }));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  getDefaultOrganizationBilling: vi.fn(),
  getOrganizationBillingWithReadThroughSync: async () => ({
    stripeCustomerId: "cus_1",
    limits: { workspaces: null, monthly: { responses: null, workflowRuns: null } },
    usageCycleAnchor: null,
    stripe: { plan: "custom", subscriptionStatus: "active", features: ["contacts"] },
  }),
}));

const LICENSE_FEATURES = {
  isMultiOrgEnabled: true,
  workspaces: null,
  twoFactorAuth: true,
  sso: true,
  whitelabel: true,
  removeBranding: true,
  contacts: true,
  aiSmartTools: true,
  saml: true,
  spamProtection: true,
  auditLogs: true,
  accessControl: true,
  quotas: true,
  feedbackDirectories: true,
  dashboards: true,
  workflows: true,
  dataRetention: true,
  creatives: true,
};
const licenseServerAnswers = (status: "active" | "expired") =>
  new Response(JSON.stringify({ data: { status, features: LICENSE_FEATURES } }), { status: 200 });

const fetchMock = vi.fn();
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => vi.setSystemTime(Date.parse("2026-11-06T13:32:00Z") + ms);
const contactsEnabled = () => hasOrganizationEntitlementWithLicenseGuard("org-1", "contacts");

describe("Cloud entitlements across a failed license refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    store.clear();
    prisma.response.count.mockResolvedValue(0);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("keeps the paid entitlement while the failed refresh is cached", async () => {
    at(0);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    // The 24 h license cache expires and the refresh fails; the failure is cached for 10 minutes.
    at(DAY + 1000);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contactsEnabled()).toBe(true);
    at(DAY + 9 * 60 * 1000);
    expect(await contactsEnabled()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("refuses the paid entitlement when the license server answers that the license expired", async () => {
    at(0);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    at(DAY + 1000);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("expired"));
    expect(await contactsEnabled()).toBe(false);
  });

  test("refuses the paid entitlement when no license was ever verified", async () => {
    at(0);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contactsEnabled()).toBe(false);
  });
});
