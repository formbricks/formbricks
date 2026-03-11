import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/ee/billing/lib/organization-billing";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getCloudOrganizationEntitlementsContext } from "./cloud-provider";

vi.mock("server-only", () => ({}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  getOrganizationBillingWithReadThroughSync: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: vi.fn(),
}));

const mockGetBilling = vi.mocked(getOrganizationBillingWithReadThroughSync);
const mockGetLicense = vi.mocked(getEnterpriseLicense);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCloudOrganizationEntitlementsContext", () => {
  test("throws ResourceNotFoundError when billing is null", async () => {
    mockGetBilling.mockResolvedValue(null);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    await expect(getCloudOrganizationEntitlementsContext("org1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("returns context with billing data", async () => {
    const usageCycleAnchor = new Date("2025-01-01");
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { projects: 5, monthly: { responses: 1000 } },
      usageCycleAnchor,
      stripe: { features: ["rbac", "spam-protection"], plan: "pro" },
    } as any);
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
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: null,
      limits: {},
      usageCycleAnchor: null,
      stripe: null,
    } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
    expect(result.limits).toEqual({ projects: null, monthlyResponses: null });
    expect(result.stripeCustomerId).toBeNull();
    expect(result.subscriptionStatus).toBeNull();
    expect(result.usageCycleAnchor).toBeNull();
  });

  test("parses string usageCycleAnchor to Date", async () => {
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: null,
      limits: {},
      usageCycleAnchor: "2025-06-15T00:00:00.000Z",
      stripe: null,
    } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.usageCycleAnchor).toBeInstanceOf(Date);
  });

  test("filters out invalid feature keys from stripe", async () => {
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: null,
      limits: {},
      usageCycleAnchor: null,
      stripe: { features: ["rbac", "invalid-feature-xyz"] },
    } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual(["rbac"]);
  });

  test("exposes subscription status from billing stripe snapshot", async () => {
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { projects: 5, monthly: { responses: 1000 } },
      usageCycleAnchor: null,
      stripe: { features: ["follow-ups"], subscriptionStatus: "trialing" },
    } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.subscriptionStatus).toBe("trialing");
  });
});
