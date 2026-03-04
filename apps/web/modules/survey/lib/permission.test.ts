import { Organization } from "@prisma/client";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { hasCloudEntitlementWithLicenseGuard } from "@/modules/billing/lib/feature-access";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { checkSpamProtectionPermission, getExternalUrlsPermission } from "./permission";

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getOrganizationBilling: vi.fn(),
}));

vi.mock("@/modules/billing/lib/feature-access", () => ({
  hasCloudEntitlementWithLicenseGuard: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    IS_FORMBRICKS_CLOUD: true,
    PROJECT_FEATURE_KEYS: {
      ...actual.PROJECT_FEATURE_KEYS,
      FREE: "free",
      PRO: "pro",
      ENTERPRISE: "enterprise",
      SCALE: "scale",
    },
  };
});

describe("checkSpamProtectionPermission", () => {
  const mockOrganizationId = "mock-organization-id";
  const mockBillingData: Organization["billing"] = {
    limits: {
      monthly: { miu: 0, responses: 0 },
      projects: 3,
    },
    period: "monthly",
    periodStart: new Date(),
    plan: "scale",
    stripeCustomerId: "mock-stripe-customer-id",
  };

  afterEach(() => {
    cleanup();
  });

  test("throws ResourceNotFoundError if organization is not found", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(null);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("resolves if spam protection is enabled", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockBillingData);
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).resolves.toBeUndefined();
  });

  test("throws OperationNotAllowedError if spam protection is not enabled", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockBillingData);
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).rejects.toThrow(OperationNotAllowedError);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).rejects.toThrow(
      "Spam protection is not enabled for this organization"
    );
  });
});

describe("getExternalUrlsPermission - Formbricks Cloud", () => {
  test("should return true when both entitlement checks return true", async () => {
    vi.mocked(hasCloudEntitlementWithLicenseGuard).mockResolvedValue(true);
    const result = await getExternalUrlsPermission({ billingPlan: "free", organizationId: "org_123" });
    expect(result).toBe(true);
  });

  test("should return false when one entitlement check fails", async () => {
    vi.mocked(hasCloudEntitlementWithLicenseGuard).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await getExternalUrlsPermission({ billingPlan: "free", organizationId: "org_123" });
    expect(result).toBe(false);
  });
});

describe("getExternalUrlsPermission - Self-hosted", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  test("should return true in self-hosted deployments", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({
      IS_FORMBRICKS_CLOUD: false,
      PROJECT_FEATURE_KEYS: {
        FREE: "free",
        PRO: "pro",
        ENTERPRISE: "enterprise",
        SCALE: "scale",
      },
    }));

    const { getExternalUrlsPermission: getExternalUrlsPermissionSelfHosted } = await import("./permission");
    const result = await getExternalUrlsPermissionSelfHosted({
      billingPlan: "free",
      organizationId: "org_123",
    });
    expect(result).toBe(true);
  });
});
