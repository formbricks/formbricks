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
    limits: { workspaces: 1, monthly: { responses: 250, workflowRuns: null } },
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
    workspaces: null,
    monthly: {
      responses: null,
      workflowRuns: null,
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
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result).toEqual({
      organizationId: "org1",
      source: "cloud_stripe",
      features: [],
      limits: { workspaces: 1, monthlyResponses: 250, monthlyWorkflowRuns: null },
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
        limits: { workspaces: 5, monthly: { responses: 1000, workflowRuns: null } },
        usageCycleAnchor,
        stripe: { features: ["rbac", "spam-protection"], plan: "pro" },
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result).toEqual({
      organizationId: "org1",
      source: "cloud_stripe",
      features: ["rbac", "spam-protection"],
      limits: { workspaces: 5, monthlyResponses: 1000, monthlyWorkflowRuns: null },
      licenseStatus: "no-license",
      licenseFeatures: null,
      stripeCustomerId: "cus_1",
      subscriptionStatus: null,
      usageCycleAnchor,
    });
  });

  test("handles missing stripe features and limits gracefully", async () => {
    mockGetBilling.mockResolvedValue(createBillingFixture({ stripe: undefined }));
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
    expect(result.limits).toEqual({ workspaces: null, monthlyResponses: null, monthlyWorkflowRuns: null });
    expect(result.stripeCustomerId).toBeNull();
    expect(result.subscriptionStatus).toBeNull();
    expect(result.usageCycleAnchor).toBeNull();
  });

  test("parses string usageCycleAnchor to Date", async () => {
    mockGetBilling.mockResolvedValue(
      createBillingFixture({
        usageCycleAnchor: new Date("2025-06-15T00:00:00.000Z"),
        stripe: undefined,
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.usageCycleAnchor).toBeInstanceOf(Date);
  });

  test("filters out invalid feature keys from stripe", async () => {
    mockGetBilling.mockResolvedValue(
      createBillingFixture({
        stripe: { features: ["rbac", "invalid-feature-xyz"] },
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual(["rbac"]);
  });

  test("exposes subscription status from billing stripe snapshot", async () => {
    mockGetBilling.mockResolvedValue(
      createBillingFixture({
        stripeCustomerId: "cus_1",
        limits: { workspaces: 5, monthly: { responses: 1000, workflowRuns: null } },
        stripe: { features: ["follow-ups"], subscriptionStatus: "trialing" },
      })
    );
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    const result = await getCloudOrganizationEntitlementsContext("org1");

    expect(result.subscriptionStatus).toBe("trialing");
  });
});
