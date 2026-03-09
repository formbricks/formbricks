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
    const periodStart = new Date("2025-01-01");
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: "cus_1",
      limits: { projects: 5, monthly: { responses: 1000 } },
      periodStart,
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
      periodStart,
    });
  });

  test("handles missing stripe features and limits gracefully", async () => {
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: null,
      limits: {},
      periodStart: null,
      stripe: null,
    } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
    expect(result.limits).toEqual({ projects: null, monthlyResponses: null });
    expect(result.stripeCustomerId).toBeNull();
    expect(result.periodStart).toBeNull();
  });

  test("parses string periodStart to Date", async () => {
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: null,
      limits: {},
      periodStart: "2025-06-15T00:00:00.000Z",
      stripe: null,
    } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.periodStart).toBeInstanceOf(Date);
  });

  test("filters out invalid feature keys from stripe", async () => {
    mockGetBilling.mockResolvedValue({
      stripeCustomerId: null,
      limits: {},
      periodStart: null,
      stripe: { features: ["rbac", "invalid-feature-xyz"] },
    } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual(["rbac"]);
  });
});
