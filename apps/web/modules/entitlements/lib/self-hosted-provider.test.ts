import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getSelfHostedOrganizationEntitlementsContext } from "./self-hosted-provider";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: vi.fn(),
}));

const mockGetOrg = vi.mocked(getOrganization);
const mockGetLicense = vi.mocked(getEnterpriseLicense);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSelfHostedOrganizationEntitlementsContext", () => {
  test("throws ResourceNotFoundError when organization is null", async () => {
    mockGetOrg.mockResolvedValue(null);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    await expect(getSelfHostedOrganizationEntitlementsContext("org1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("returns context with no license features", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false });

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result).toEqual({
      organizationId: "org1",
      source: "self_hosted_license",
      features: [],
      limits: { projects: 3, monthlyResponses: null },
      licenseStatus: "no-license",
      licenseFeatures: null,
      stripeCustomerId: null,
      subscriptionStatus: null,
      usageCycleAnchor: null,
    });
  });

  test("maps license features to entitlements", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: {
        removeBranding: true,
        accessControl: true,
        quotas: false,
        spamProtection: true,
        contacts: true,
        projects: 10,
      },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("hide-branding");
    expect(result.features).toContain("rbac");
    expect(result.features).toContain("spam-protection");
    expect(result.features).toContain("contacts");
    expect(result.features).not.toContain("quota-management");
    expect(result.limits.projects).toBe(10);
  });

  test("defaults projects to 3 when license is inactive", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "expired",
      active: false,
      features: { projects: 10, contacts: true, spamProtection: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
    expect(result.limits.projects).toBe(3);
  });

  test("maps whitelabel feature to hide-branding", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: { whitelabel: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("hide-branding");
  });
});
