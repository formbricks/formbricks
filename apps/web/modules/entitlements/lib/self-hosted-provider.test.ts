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
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    await expect(getSelfHostedOrganizationEntitlementsContext("org1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("returns context with no license features", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({ status: "no-license", features: null, active: false } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result).toEqual({
      organizationId: "org1",
      source: "self_hosted_license",
      features: [],
      limits: { workspaces: 3, monthlyResponses: null, monthlyWorkflowRuns: null },
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
        workspaces: 10,
      },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("hide-branding");
    expect(result.features).toContain("rbac");
    expect(result.features).toContain("spam-protection");
    expect(result.features).toContain("contacts");
    expect(result.features).not.toContain("quota-management");
    expect(result.limits.workspaces).toBe(10);
  });

  test("defaults workspaces to 3 when license is inactive", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "expired",
      active: false,
      features: { workspaces: 10, contacts: true, spamProtection: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
    expect(result.limits.workspaces).toBe(3);
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

  test("maps aiSmartTools feature to ai-smart-tools entitlement", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: { aiSmartTools: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("ai-smart-tools");
  });

  test("maps feedbackDirectories feature to feedback-directories entitlement", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: { feedbackDirectories: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("feedback-directories");
    expect(result.features).not.toContain("dashboards");
  });

  test("maps dashboards feature to dashboards entitlement", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: { dashboards: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("dashboards");
    expect(result.features).not.toContain("feedback-directories");
  });

  test("maps workflows feature to workflows entitlement", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: { workflows: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("workflows");
    expect(result.features).not.toContain("dashboards");
  });

  test("does not map workflows entitlement when the license flag is off", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: { workflows: false, dashboards: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).not.toContain("workflows");
  });

  test("maps both Hub features when all enabled", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "active",
      active: true,
      features: { feedbackDirectories: true, dashboards: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("feedback-directories");
    expect(result.features).toContain("dashboards");
  });

  test("does not map Hub features when license inactive even if flags are true", async () => {
    mockGetOrg.mockResolvedValue({ id: "org1" } as any);
    mockGetLicense.mockResolvedValue({
      status: "expired",
      active: false,
      features: { feedbackDirectories: true, dashboards: true },
    } as any);

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
  });
});
