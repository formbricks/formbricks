import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import type { TOrganization } from "@formbricks/types/organizations";
import { getOrganization } from "@/lib/organization/service";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
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

type TLicenseResult = Awaited<ReturnType<typeof getEnterpriseLicense>>;

/**
 * The provider reads nothing off the organization — it only rejects a missing one — so this exists to
 * satisfy the return type rather than to carry meaningful values. Typed so it still has to be a real
 * `TOrganization` if the shape changes.
 */
const organization: TOrganization = {
  id: "org1",
  name: "Test Organization",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    stripeCustomerId: null,
    limits: {
      workspaces: 3,
      monthly: { responses: 1500, workflowRuns: null },
    },
    usageCycleAnchor: null,
  },
  isAISmartToolsEnabled: false,
};

/**
 * Complete feature set, everything off. Typed rather than cast so a new field on
 * `ZEnterpriseLicenseFeatures` breaks this file instead of silently defaulting to absent — the tests
 * below assert on which entitlements a flag does and does not produce, which only means something if
 * the unnamed flags are genuinely off.
 */
const licenseFeatures = (
  overrides: Partial<TEnterpriseLicenseFeatures> = {}
): TEnterpriseLicenseFeatures => ({
  isMultiOrgEnabled: false,
  contacts: false,
  workspaces: 3,
  whitelabel: false,
  removeBranding: false,
  twoFactorAuth: false,
  sso: false,
  saml: false,
  spamProtection: false,
  aiSmartTools: false,
  auditLogs: false,
  accessControl: false,
  quotas: false,
  feedbackDirectories: false,
  dashboards: false,
  workflows: false,
  ...overrides,
});

const activeLicense = (features: Partial<TEnterpriseLicenseFeatures> = {}): TLicenseResult => ({
  status: "active",
  active: true,
  features: licenseFeatures(features),
  lastChecked: new Date(),
  isPendingDowngrade: false,
  fallbackLevel: "live",
});

const expiredLicense = (features: Partial<TEnterpriseLicenseFeatures> = {}): TLicenseResult => ({
  ...activeLicense(features),
  status: "expired",
  active: false,
});

const noLicense = (): TLicenseResult => ({
  ...activeLicense(),
  status: "no-license",
  active: false,
  features: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSelfHostedOrganizationEntitlementsContext", () => {
  test("throws ResourceNotFoundError when organization is null", async () => {
    mockGetOrg.mockResolvedValue(null);
    mockGetLicense.mockResolvedValue(noLicense());

    await expect(getSelfHostedOrganizationEntitlementsContext("org1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("returns context with no license features", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(noLicense());

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result).toEqual({
      organizationId: "org1",
      source: "self_hosted_license",
      features: [],
      limits: { workspaces: 1, monthlyResponses: null, monthlyWorkflowRuns: null },
      licenseStatus: "no-license",
      licenseFeatures: null,
      stripeCustomerId: null,
      subscriptionStatus: null,
      usageCycleAnchor: null,
    });
  });

  test("maps license features to entitlements", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(
      activeLicense({
        removeBranding: true,
        accessControl: true,
        quotas: false,
        spamProtection: true,
        contacts: true,
        workspaces: 10,
      })
    );

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("hide-branding");
    expect(result.features).toContain("rbac");
    expect(result.features).toContain("spam-protection");
    expect(result.features).toContain("contacts");
    expect(result.features).not.toContain("quota-management");
    expect(result.limits.workspaces).toBe(10);
  });

  test("keeps workspaces null (unlimited) when an active license grants unlimited workspaces", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ workspaces: null, contacts: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.limits.workspaces).toBeNull();
  });

  test("defaults workspaces to the community limit when license is inactive", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(
      expiredLicense({ workspaces: 10, contacts: true, spamProtection: true })
    );

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
    expect(result.limits.workspaces).toBe(1);
  });

  test("maps whitelabel feature to hide-branding", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ whitelabel: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("hide-branding");
  });

  test("maps aiSmartTools feature to ai-smart-tools entitlement", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ aiSmartTools: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("ai-smart-tools");
  });

  test("maps feedbackDirectories feature to feedback-directories entitlement", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ feedbackDirectories: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("feedback-directories");
    expect(result.features).not.toContain("dashboards");
  });

  test("maps dashboards feature to dashboards entitlement", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ dashboards: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("dashboards");
    expect(result.features).not.toContain("feedback-directories");
  });

  test("maps workflows feature to workflows entitlement", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ workflows: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("workflows");
    expect(result.features).not.toContain("dashboards");
  });

  test("does not map workflows entitlement when the license flag is off", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ workflows: false, dashboards: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).not.toContain("workflows");
  });

  test("maps both Hub features when all enabled", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(activeLicense({ feedbackDirectories: true, dashboards: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toContain("feedback-directories");
    expect(result.features).toContain("dashboards");
  });

  test("does not map Hub features when license inactive even if flags are true", async () => {
    mockGetOrg.mockResolvedValue(organization);
    mockGetLicense.mockResolvedValue(expiredLicense({ feedbackDirectories: true, dashboards: true }));

    const result = await getSelfHostedOrganizationEntitlementsContext("org1");

    expect(result.features).toEqual([]);
  });
});
