import { Organization } from "@prisma/client";
import fetch from "node-fetch";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getBiggerUploadFileSizePermission,
  getIsContactsEnabled,
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSpamProtectionEnabled,
  getIsTwoFactorAuthEnabled,
  getLicenseFeatures,
  getMultiLanguagePermission,
  getOrganizationProjectsLimit,
  getRemoveBrandingPermission,
  getRoleManagementPermission,
  getWhiteLabelPermission,
  getisSsoEnabled,
} from "./utils";

// Mock declarations must be at the top level
vi.mock("@/lib/env", () => ({
  env: {
    ENTERPRISE_LICENSE_KEY: "test-license-key",
  },
}));

vi.mock("@/lib/constants", () => ({
  E2E_TESTING: false,
  ENTERPRISE_LICENSE_KEY: "test-license-key",
  IS_FORMBRICKS_CLOUD: false,
  IS_RECAPTCHA_CONFIGURED: true,
  PROJECT_FEATURE_KEYS: {
    removeBranding: "remove-branding",
    whiteLabel: "white-label",
    roleManagement: "role-management",
    biggerUploadFileSize: "bigger-upload-file-size",
    multiLanguage: "multi-language",
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: vi.fn((fn) => fn),
  revalidateTag: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn(),
}));

vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

describe("License Check Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Feature Permissions", () => {
    const mockOrganization = {
      billing: {
        plan: "enterprise" as Organization["billing"]["plan"],
        limits: {
          projects: 3,
        },
      },
    } as Organization;

    test("getRemoveBrandingPermission", async () => {
      const result = await getRemoveBrandingPermission(mockOrganization.billing.plan);
      expect(result).toBe(false); // Default value when no license is active
    });

    test("getWhiteLabelPermission", async () => {
      const result = await getWhiteLabelPermission(mockOrganization.billing.plan);
      expect(result).toBe(false); // Default value when no license is active
    });

    test("getRoleManagementPermission", async () => {
      const result = await getRoleManagementPermission(mockOrganization.billing.plan);
      expect(result).toBe(false); // Default value when no license is active
    });

    test("getBiggerUploadFileSizePermission", async () => {
      const result = await getBiggerUploadFileSizePermission(mockOrganization.billing.plan);
      expect(result).toBe(false); // Default value when no license is active
    });

    test("getMultiLanguagePermission", async () => {
      const result = await getMultiLanguagePermission(mockOrganization.billing.plan);
      expect(result).toBe(false); // Default value when no license is active
    });

    test("getIsMultiOrgEnabled", async () => {
      const result = await getIsMultiOrgEnabled();
      expect(typeof result).toBe("boolean");
    });

    test("getIsContactsEnabled", async () => {
      const result = await getIsContactsEnabled();
      expect(typeof result).toBe("boolean");
    });

    test("getIsTwoFactorAuthEnabled", async () => {
      const result = await getIsTwoFactorAuthEnabled();
      expect(typeof result).toBe("boolean");
    });

    test("getisSsoEnabled", async () => {
      const result = await getisSsoEnabled();
      expect(typeof result).toBe("boolean");
    });

    test("getIsSamlSsoEnabled", async () => {
      const result = await getIsSamlSsoEnabled();
      expect(typeof result).toBe("boolean");
    });

    test("getIsSpamProtectionEnabled", async () => {
      const result = await getIsSpamProtectionEnabled(mockOrganization.billing.plan);
      expect(result).toBe(false); // Default value when no license is active
    });

    test("getOrganizationProjectsLimit", async () => {
      const result = await getOrganizationProjectsLimit(mockOrganization.billing.limits);
      expect(result).toBe(3); // Default value from mock organization
    });
  });

  describe("License Features", () => {
    test("getLicenseFeatures returns null when no license is active", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
      } as any);

      const result = await getLicenseFeatures();
      expect(result).toBeNull();
    });
  });
});
