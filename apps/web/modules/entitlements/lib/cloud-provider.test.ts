import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TOrganizationBilling } from "@formbricks/types/organizations";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/ee/billing/lib/organization-billing";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getCloudOrganizationEntitlementsContext } from "./cloud-provider";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn() },
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  getOrganizationBillingWithReadThroughSync: vi.fn(),
  getDefaultOrganizationBilling: () => ({
    limits: { projects: 1, monthly: { responses: 250 } },
    stripeCustomerId: null,
    usageCycleAnchor: null,
  }),
}));

vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: vi.fn(),
}));

const mockGetBilling = vi.mocked(getOrganizationBillingWithReadThroughSync);
const mockGetLicense = vi.mocked(getEnterpriseLicense);

const createBillingFixture = (overrides: Partial<TOrganizationBilling> = {}): TOrganizationBilling => ({
  stripeCustomerId: null,
  limits: {
    projects: null,
    monthly: {
      responses: null,
    },
  },
  usageCycleAnchor: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCloudOrganizationEntitlementsContext", () => {
  test("returns default entitlements when billing is null", async () => {
    mockGetBilling.mockResolvedValue(null);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result).toEqual({
      organizationId: "org1",
      source: "cloud_stripe",
      features: [],
      limits: { projects: 1, monthlyResponses: 250 },
      licenseStatus: "no-license",
      licenseFeatures: null,
      stripeCustomerId: null,
      subscriptionStatus: null,
      usageCycleAnchor: null,
    });
  });

  test("returns context with billing data", async () => {
    const usageCycleAnchor = new Date("2025-01-01");
    mockGetBilling.mockResolvedValue(
      createBillingFixture({
        stripeCustomerId: "cus_1",
        limits: { projects: 5, monthly: { responses: 1000 } },
        usageCycleAnchor,
        stripe: { features: ["rbac", "spam-protection"], plan: "pro" },
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result).toEqual({
      organizationId: "org1",
      source: "cloud_stripe",
      features: ["rbac", "spam-protection"],
      limits: { projects: 5, monthlyResponses: 1000 },
      licenseStatus: "no-license",
      licenseFeatures: null,
      stripeCustomerId: "cus_1",
      subscriptionStatus: null,
      usageCycleAnchor,
    });
  });

  test("handles missing stripe features and limits gracefully", async () => {
    mockGetBilling.mockResolvedValue(createBillingFixture({ stripe: null }));
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
    expect(result.limits).toEqual({ projects: null, monthlyResponses: null });
    expect(result.stripeCustomerId).toBeNull();
    expect(result.subscriptionStatus).toBeNull();
    expect(result.usageCycleAnchor).toBeNull();
  });

  test("parses string usageCycleAnchor to Date", async () => {
    mockGetBilling.mockResolvedValue(
      createBillingFixture({
        usageCycleAnchor: "2025-06-15T00:00:00.000Z",
        stripe: null,
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.usageCycleAnchor).toBeInstanceOf(Date);
  });

  test("filters out invalid feature keys from stripe", async () => {
    mockGetBilling.mockResolvedValue(
      createBillingFixture({
        stripe: { features: ["rbac", "invalid-feature-xyz"] },
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual(["rbac"]);
  });

  test("exposes subscription status from billing stripe snapshot", async () => {
    mockGetBilling.mockResolvedValue(
      createBillingFixture({
        stripeCustomerId: "cus_1",
        limits: { projects: 5, monthly: { responses: 1000 } },
        stripe: { features: ["follow-ups"], subscriptionStatus: "trialing" },
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.subscriptionStatus).toBe("trialing");
  });
});
