import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getOrganizationEntitlementLimits,
  hasOrganizationEntitlement,
  hasOrganizationEntitlementWithLicenseGuard,
} from "./checks";
import { getOrganizationEntitlementsContext } from "./provider";
import type { TOrganizationEntitlementsContext } from "./types";

vi.mock("server-only", () => ({}));

vi.mock("./provider", () => ({
  getOrganizationEntitlementsContext: vi.fn(),
}));

vi.mock("./types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./types")>();
  return {
    ...actual,
    isEntitlementFeature: actual.isEntitlementFeature,
  };
});

const mockGetContext = vi.mocked(getOrganizationEntitlementsContext);

const baseContext: TOrganizationEntitlementsContext = {
  organizationId: "org1",
  source: "cloud_stripe",
  features: ["rbac", "spam-protection"],
  limits: { projects: 3, monthlyResponses: 500 },
  licenseStatus: "no-license",
  licenseFeatures: null,
  stripeCustomerId: "cus_1",
  subscriptionStatus: null,
  usageCycleAnchor: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasOrganizationEntitlement", () => {
  test("returns true when feature is present", async () => {
    mockGetContext.mockResolvedValue(baseContext);
    expect(await hasOrganizationEntitlement("org1", "rbac")).toBe(true);
  });

  test("returns false when feature is absent", async () => {
    mockGetContext.mockResolvedValue(baseContext);
    expect(await hasOrganizationEntitlement("org1", "hide-branding")).toBe(false);
  });

  test("returns false for unknown feature key", async () => {
    mockGetContext.mockResolvedValue(baseContext);
    expect(await hasOrganizationEntitlement("org1", "not-a-feature")).toBe(false);
  });
});

describe("hasOrganizationEntitlementWithLicenseGuard", () => {
  test("returns true when no license and feature present", async () => {
    mockGetContext.mockResolvedValue(baseContext);
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "rbac")).toBe(true);
  });

  test("returns false for trial-restricted follow-ups while trialing", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      features: ["follow-ups"],
      subscriptionStatus: "trialing",
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "follow-ups")).toBe(false);
  });

  test("returns false for trial-restricted custom links while trialing", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      features: ["custom-links-in-surveys"],
      subscriptionStatus: "trialing",
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "custom-links-in-surveys")).toBe(false);
  });

  test("returns false for trial-restricted custom redirect while trialing", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      features: ["custom-redirect-url"],
      subscriptionStatus: "trialing",
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "custom-redirect-url")).toBe(false);
  });

  test("returns false when feature not present", async () => {
    mockGetContext.mockResolvedValue(baseContext);
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "hide-branding")).toBe(false);
  });

  test("returns false for unknown feature key", async () => {
    mockGetContext.mockResolvedValue(baseContext);
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "not-a-feature")).toBe(false);
  });

  test("returns false when license is inactive", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      licenseStatus: "expired",
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "rbac")).toBe(false);
  });

  test("returns true when license active and mapped feature enabled", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      licenseStatus: "active",
      licenseFeatures: { accessControl: true } as TOrganizationEntitlementsContext["licenseFeatures"],
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "rbac")).toBe(true);
  });

  test("returns false when license active but mapped feature disabled", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      licenseStatus: "active",
      licenseFeatures: { accessControl: false } as TOrganizationEntitlementsContext["licenseFeatures"],
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "rbac")).toBe(false);
  });

  test("returns true when license active and feature has no license mapping", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      features: ["custom-redirect-url"],
      licenseStatus: "active",
      subscriptionStatus: "active",
      licenseFeatures: {} as TOrganizationEntitlementsContext["licenseFeatures"],
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "custom-redirect-url")).toBe(true);
  });

  test("does not affect unrelated features while trialing", async () => {
    mockGetContext.mockResolvedValue({
      ...baseContext,
      features: ["rbac"],
      subscriptionStatus: "trialing",
    });
    expect(await hasOrganizationEntitlementWithLicenseGuard("org1", "rbac")).toBe(true);
  });
});

describe("getOrganizationEntitlementLimits", () => {
  test("returns limits from context", async () => {
    mockGetContext.mockResolvedValue(baseContext);
    expect(await getOrganizationEntitlementLimits("org1")).toEqual({
      projects: 3,
      monthlyResponses: 500,
    });
  });
});
