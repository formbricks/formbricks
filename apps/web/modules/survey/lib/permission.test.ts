import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { hasCloudEntitlementWithLicenseGuard } from "@/modules/billing/lib/feature-access";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { checkSpamProtectionPermission, getExternalUrlsPermission } from "./permission";

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

vi.mock("@/modules/billing/lib/feature-access", () => ({
  hasCloudEntitlementWithLicenseGuard: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    IS_FORMBRICKS_CLOUD: true,
  };
});

describe("checkSpamProtectionPermission", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("resolves when spam protection is enabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);

    await expect(checkSpamProtectionPermission("org_1")).resolves.toBeUndefined();
  });

  test("throws when spam protection is not enabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);

    await expect(checkSpamProtectionPermission("org_1")).rejects.toThrow(OperationNotAllowedError);
    await expect(checkSpamProtectionPermission("org_1")).rejects.toThrow(
      "Spam protection is not enabled for this organization"
    );
  });
});

describe("getExternalUrlsPermission - cloud", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns true when both entitlement checks pass", async () => {
    vi.mocked(hasCloudEntitlementWithLicenseGuard).mockResolvedValue(true);

    const result = await getExternalUrlsPermission({ organizationId: "org_123" });

    expect(result).toBe(true);
    expect(hasCloudEntitlementWithLicenseGuard).toHaveBeenCalledTimes(2);
  });

  test("returns false when one entitlement check fails", async () => {
    vi.mocked(hasCloudEntitlementWithLicenseGuard).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await getExternalUrlsPermission({ organizationId: "org_123" });

    expect(result).toBe(false);
  });
});

describe("getExternalUrlsPermission - self-hosted", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("returns true in self-hosted deployments", async () => {
    vi.doMock("@/lib/constants", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/constants")>();
      return {
        ...actual,
        IS_FORMBRICKS_CLOUD: false,
      };
    });

    const { getExternalUrlsPermission: getExternalUrlsPermissionSelfHosted } = await import("./permission");
    const result = await getExternalUrlsPermissionSelfHosted({ organizationId: "org_123" });

    expect(result).toBe(true);
    expect(hasCloudEntitlementWithLicenseGuard).not.toHaveBeenCalled();
  });
});
