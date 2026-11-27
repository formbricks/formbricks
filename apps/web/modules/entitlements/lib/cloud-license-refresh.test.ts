// ENG-7563. A Cloud organization's paid entitlement across a failed license refresh, through the real
// license client (fetch, Redis caching, grace logic), the real Cloud provider and the real guard. The
// unit tests in checks.test.ts build the grace context by hand; this one proves the guard accepts the
// shape license.ts actually produces. Only the module boundaries are faked: the license server
// (global fetch), Redis (an in-memory TTL store), Prisma, the instance id and the Stripe snapshot.
import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getCacheKeys } from "@/modules/ee/license-check/lib/license";
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

  test("keeps refusing after the license server answers expired, even when a later check fails", async () => {
    at(0);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    at(DAY + 1000);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("expired"));
    expect(await contactsEnabled()).toBe(false);

    // Still inside the grace window of the last active answer, the next refresh fails.
    at(2 * DAY + 2000);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contactsEnabled()).toBe(false);
  });

  // 400: the key is unknown (invalid_license); 403: it is bound to another instance (instance_mismatch).
  test.each([400, 403])(
    "keeps refusing after an HTTP %i rejection, even when a later check fails",
    async (status) => {
      at(0);
      fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
      expect(await contactsEnabled()).toBe(true);

      at(DAY + 1000);
      fetchMock.mockResolvedValueOnce(new Response(null, { status }));
      expect(await contactsEnabled()).toBe(false);

      // A rejection is not cached, so the next request checks again; past the 90 s fetch lock it fails.
      at(DAY + 2 * 60 * 1000);
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      expect(await contactsEnabled()).toBe(false);
    }
  );

  test("a later active answer clears the refusal, so the next failed check keeps the entitlement", async () => {
    at(0);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    at(DAY + 1000);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("expired"));
    expect(await contactsEnabled()).toBe(false);

    at(2 * DAY + 2000);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    at(3 * DAY + 3000);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contactsEnabled()).toBe(true);
  });

  // The same, all within an hour of the last active answer, where the previous result is otherwise not
  // rewritten. The fetch cache is dropped to force each check, as a recheck or a Redis eviction would.
  test("an active answer within the hour still clears the refusal", async () => {
    const dropFetchCache = () => store.delete(getCacheKeys().FETCH_LICENSE_CACHE_KEY);
    at(0);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    at(10 * 60 * 1000);
    dropFetchCache();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
    expect(await contactsEnabled()).toBe(false);

    at(20 * 60 * 1000);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    at(30 * 60 * 1000);
    dropFetchCache();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contactsEnabled()).toBe(true);
  });

  test("refuses the paid entitlement once the grace period has ended", async () => {
    at(0);
    fetchMock.mockResolvedValueOnce(licenseServerAnswers("active"));
    expect(await contactsEnabled()).toBe(true);

    at(3 * DAY + 1000);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contactsEnabled()).toBe(false);
  });

  test("refuses the paid entitlement when no license was ever verified", async () => {
    at(0);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await contactsEnabled()).toBe(false);
  });
});
