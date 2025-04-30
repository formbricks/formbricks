import { PROJECT_FEATURE_KEYS } from "@/lib/constants";
import { TEnterpriseLicenseDetails } from "@/modules/ee/license-check/types/enterprise-license";
import { Organization } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
// Import only fetchLicense initially, others will be imported dynamically in tests
import { fetchLicense } from "./utils";

// Mock dependencies
vi.mock("@/lib/cache", () => ({
  cache: vi.fn((fn) => fn), // Mock cache to just execute the function
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/constants", async () => {
  const actual = await vi.importActual("@/lib/constants");
  return {
    ...actual,
    ENTERPRISE_LICENSE_KEY: "test-license-key",
    IS_FORMBRICKS_CLOUD: false,
    E2E_TESTING: false,
    IS_RECAPTCHA_CONFIGURED: true,
  };
});

vi.mock("@/lib/env", () => ({
  env: {
    ENTERPRISE_LICENSE_KEY: "test-license-key",
    HTTPS_PROXY: undefined,
    HTTP_PROXY: undefined,
  },
}));

vi.mock("@/lib/hashString", () => ({
  hashString: vi.fn((s) => `hashed-${s}`),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn) => fn()), // Mock after to execute the function immediately
}));

const mockFetch = vi.mocked(require("node-fetch").default);
const mockPrismaResponseCount = vi.mocked(prisma.response.count);
const mockCache = vi.mocked(require("@/lib/cache").cache);
const mockRevalidateTag = vi.mocked(require("@/lib/cache").revalidateTag);
const mockLoggerError = vi.mocked(require("@formbricks/logger").logger.error);

const defaultFeatures = {
  isMultiOrgEnabled: true,
  twoFactorAuth: true,
  sso: true,
  contacts: true,
  projects: 10,
  whitelabel: true,
  removeBranding: true,
  spamProtection: true,
  ai: true,
  saml: true,
};

// Adjusted mock type to match expected structure from fetch
const defaultLicenseDetails: Omit<TEnterpriseLicenseDetails, "licenseKey"> & {
  status: "active" | "inactive" | "expired";
} = {
  status: "active",
  features: defaultFeatures,
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Expires in 1 year
};

const inactiveLicenseDetails: typeof defaultLicenseDetails = {
  ...defaultLicenseDetails,
  status: "inactive", // Keep inactive for testing logic, TS error was likely misleading
};

const nullFeatures = {
  isMultiOrgEnabled: false,
  projects: 3,
  twoFactorAuth: false,
  sso: false,
  whitelabel: false,
  removeBranding: false,
  contacts: false,
  ai: false,
  saml: false,
  spamProtection: false,
};

const mockBillingPlanFree: Organization["billing"]["plan"] = PROJECT_FEATURE_KEYS.FREE;
const mockBillingPlanScale: Organization["billing"]["plan"] = PROJECT_FEATURE_KEYS.SCALE;
const mockBillingPlanEnterprise: Organization["billing"]["plan"] = PROJECT_FEATURE_KEYS.ENTERPRISE;
// Added missing monthly property
const mockBillingLimits: Organization["billing"]["limits"] = {
  projects: 5,
  monthly: { responses: null, miu: null },
};

describe("Enterprise License Utils", () => {
  let originalConstants: any;
  let originalEnv: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockPrismaResponseCount.mockResolvedValue(100);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: defaultLicenseDetails }),
    } as any);

    // Store original constants and env
    originalConstants = await vi.importActual("@/lib/constants");
    originalEnv = await vi.importActual("@/lib/env");

    // Reset modules to ensure constants/env are re-imported with mocks
    vi.resetModules();

    // Re-mock constants and env for each test if needed
    vi.mock("@/lib/constants", () => ({
      ...originalConstants,
      ENTERPRISE_LICENSE_KEY: "test-license-key",
      IS_FORMBRICKS_CLOUD: false,
      E2E_TESTING: false,
      IS_RECAPTCHA_CONFIGURED: true,
    }));
    vi.mock("@/lib/env", () => ({
      env: {
        ...originalEnv.env,
        ENTERPRISE_LICENSE_KEY: "test-license-key",
        HTTPS_PROXY: undefined,
        HTTP_PROXY: undefined,
      },
    }));
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after each test
  });

  describe("fetchLicense", () => {
    test("should return null if no license key is provided in env", async () => {
      vi.mock("@/lib/env", () => ({ env: { ENTERPRISE_LICENSE_KEY: undefined } }));
      vi.resetModules(); // Re-import fetchLicense with new env mock
      const { fetchLicense: fetchLicenseLocal } = await import("./utils");
      const license = await fetchLicenseLocal();
      expect(license).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should fetch license details successfully", async () => {
      const { fetchLicense: fetchLicenseLocal } = await import("./utils");
      const license = await fetchLicenseLocal();
      // Don't check for licenseKey in the returned object
      expect(license).toEqual(expect.objectContaining(defaultLicenseDetails));
      expect(mockFetch).toHaveBeenCalledWith("https://ee.formbricks.com/api/licenses/check", {
        body: JSON.stringify({
          licenseKey: "test-license-key",
          usage: { responseCount: 100 },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        agent: undefined,
      });
      expect(mockPrismaResponseCount).toHaveBeenCalled();
    });

    test("should return null if fetch response is not ok", async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);
      const { fetchLicense: fetchLicenseLocal } = await import("./utils");
      const license = await fetchLicenseLocal();
      expect(license).toBeNull();
    });

    test("should return null if fetch throws an error", async () => {
      const error = new Error("Network error");
      mockFetch.mockRejectedValue(error);
      const { fetchLicense: fetchLicenseLocal } = await import("./utils");
      const license = await fetchLicenseLocal();
      expect(license).toBeNull();
      expect(mockLoggerError).toHaveBeenCalledWith(error, "Error while checking license");
    });

    test("should use proxy agent if proxy env var is set", async () => {
      vi.mock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          HTTPS_PROXY: "http://proxy.example.com:8080",
        },
      }));
      vi.resetModules();
      const { fetchLicense: fetchLicenseLocal } = await import("./utils");
      await fetchLicenseLocal();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://ee.formbricks.com/api/licenses/check",
        expect.objectContaining({
          agent: expect.any(Object), // HttpsProxyAgent is complex to instantiate directly here
        })
      );
    });
  });

  describe("getEnterpriseLicense", () => {
    // Removed getPreviousResultMock and setPreviousResultMock declarations

    beforeEach(() => {
      // Mock the internal cache functions getPreviousResult and setPreviousResult
      let cacheStore: any = {};
      const PREVIOUS_RESULTS_CACHE_TAG_KEY = "getPreviousResult-hashed-test-license-key";

      // Simplified mock implementation
      mockCache.mockImplementation(async (fn, keyArgs) => {
        const key = keyArgs?.[0];
        if (key === PREVIOUS_RESULTS_CACHE_TAG_KEY) {
          // This simulates the behavior of the cache for the specific key
          return async () => cacheStore[key] ?? { active: null, lastChecked: new Date(0), features: null };
        }
        // For fetchLicense cache call or others
        const result = await fn();
        if (key === PREVIOUS_RESULTS_CACHE_TAG_KEY) {
          // Simulate setting the result back to cache
          cacheStore[key] = result;
        }
        return async () => result; // Return a function that returns the result, mimicking cache behavior
      });

      // Need to re-import to get the mocked cache behavior inside the module
      vi.resetModules();
      vi.mock("@/lib/cache", () => ({
        cache: mockCache,
        revalidateTag: mockRevalidateTag,
      }));
    });

    test("should return inactive if no license key constant", async () => {
      vi.mock("@/lib/constants", async () => ({
        ...(await vi.importActual("@/lib/constants")),
        ENTERPRISE_LICENSE_KEY: undefined,
      }));
      vi.resetModules();
      const { getEnterpriseLicense: getEnterpriseLicenseLocal } = await import("./utils");
      const licenseStatus = await getEnterpriseLicenseLocal();
      expect(licenseStatus).toEqual({ active: false, features: null, lastChecked: expect.any(Date) });
    });

    test("should handle E2E_TESTING mode correctly", async () => {
      vi.mock("@/lib/constants", async () => ({
        ...(await vi.importActual("@/lib/constants")),
        ENTERPRISE_LICENSE_KEY: "test-license-key",
        E2E_TESTING: true,
      }));
      vi.resetModules();
      // Don't import fetchLicenseForE2ETesting
      const { getEnterpriseLicense: getEnterpriseLicenseLocal } = await import("./utils");

      // First call
      let licenseStatus = await getEnterpriseLicenseLocal();
      expect(licenseStatus.active).toBe(true);
      // Check against the specific features defined for E2E testing in the original code
      expect(licenseStatus.features).toEqual({
        isMultiOrgEnabled: true,
        twoFactorAuth: true,
        sso: true,
        contacts: true,
        projects: 3,
        whitelabel: true,
        removeBranding: true,
        spamProtection: true,
        ai: true,
        saml: true,
      });

      // Second call (within 1 hour) - should use cached result
      licenseStatus = await getEnterpriseLicenseLocal();
      expect(licenseStatus.active).toBe(true);

      // Third call (after 1 hour) - should revoke
      vi.useFakeTimers();
      vi.advanceTimersByTime(60 * 60 * 1000 + 1); // Advance time by 1 hour and 1 ms
      licenseStatus = await getEnterpriseLicenseLocal();
      expect(licenseStatus.active).toBe(false);
      expect(licenseStatus.features).toBeNull();
      vi.useRealTimers();
    });

    test("should return active license status on successful fetch", async () => {
      const { getEnterpriseLicense: getEnterpriseLicenseLocal } = await import("./utils");
      const licenseStatus = await getEnterpriseLicenseLocal();
      expect(licenseStatus.active).toBe(true);
      expect(licenseStatus.features).toEqual(defaultFeatures);
      expect(licenseStatus.lastChecked).toBeInstanceOf(Date);
    });

    test("should return inactive license status on successful fetch with inactive status", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: inactiveLicenseDetails }),
      } as any);
      vi.resetModules();
      const { getEnterpriseLicense: getEnterpriseLicenseLocal } = await import("./utils");
      const licenseStatus = await getEnterpriseLicenseLocal();
      expect(licenseStatus.active).toBe(false);
      expect(licenseStatus.features).toEqual(defaultFeatures); // Features might still be returned
      expect(licenseStatus.lastChecked).toBeInstanceOf(Date);
    });

    test("should return default inactive on first fetch error", async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);
      vi.resetModules();
      const { getEnterpriseLicense: getEnterpriseLicenseLocal } = await import("./utils");
      const licenseStatus = await getEnterpriseLicenseLocal();
      expect(licenseStatus.active).toBe(false);
      expect(licenseStatus.features).toEqual(nullFeatures); // Default features when inactive
      expect(licenseStatus.lastChecked).toBeInstanceOf(Date);
    });

    test("should return previous result if fetch fails within 72 hours", async () => {
      const now = Date.now();
      const lastCheckedDate = new Date(now - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const previousResult = { active: true, features: defaultFeatures, lastChecked: lastCheckedDate };

      // Simulate previous result being set in the cache mock
      let cacheStore: any = { "getPreviousResult-hashed-test-license-key": previousResult };
      mockCache.mockImplementation(async (fn, keyArgs) => {
        const key = keyArgs?.[0];
        if (key === "getPreviousResult-hashed-test-license-key") {
          return async () => cacheStore[key] ?? { active: null, lastChecked: new Date(0), features: null };
        }
        // Prevent fetchLicense from running and simulate failure
        if (key?.startsWith("fetchLicense")) {
          return async () => null;
        }
        const result = await fn();
        if (key === PREVIOUS_RESULTS_CACHE_TAG_KEY) {
          cacheStore[key] = result;
        }
        return async () => result;
      });
      vi.resetModules();
      vi.mock("@/lib/cache", () => ({ cache: mockCache, revalidateTag: mockRevalidateTag }));

      mockFetch.mockResolvedValue({ ok: false } as any); // Ensure fetch mock reflects failure

      const { getEnterpriseLicense: getEnterpriseLicenseLocal } = await import("./utils");
      const licenseStatus = await getEnterpriseLicenseLocal();

      expect(licenseStatus.active).toBe(true); // Should return previous active state
      expect(licenseStatus.features).toEqual(defaultFeatures);
      expect(licenseStatus.lastChecked).toEqual(lastCheckedDate);
      expect(licenseStatus.isPendingDowngrade).toBe(true);
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    test("should return inactive and log error if fetch fails after 72 hours", async () => {
      const now = Date.now();
      const lastCheckedDate = new Date(now - 4 * 24 * 60 * 60 * 1000); // 4 days ago
      const previousResult = { active: true, features: defaultFeatures, lastChecked: lastCheckedDate };

      // Simulate previous result being set
      let cacheStore: any = { "getPreviousResult-hashed-test-license-key": previousResult };
      mockCache.mockImplementation(async (fn, keyArgs) => {
        const key = keyArgs?.[0];
        if (key === "getPreviousResult-hashed-test-license-key") {
          return async () => cacheStore[key] ?? { active: null, lastChecked: new Date(0), features: null };
        }
        if (key?.startsWith("fetchLicense")) {
          return async () => null;
        }
        const result = await fn();
        if (key === PREVIOUS_RESULTS_CACHE_TAG_KEY) {
          cacheStore[key] = result;
        }
        return async () => result;
      });
      vi.resetModules();
      vi.mock("@/lib/cache", () => ({ cache: mockCache, revalidateTag: mockRevalidateTag }));

      mockFetch.mockResolvedValue({ ok: false } as any); // Simulate fetch failure

      const { getEnterpriseLicense: getEnterpriseLicenseLocal } = await import("./utils");
      const licenseStatus = await getEnterpriseLicenseLocal();

      expect(licenseStatus.active).toBe(false); // Should return inactive
      expect(licenseStatus.features).toBeNull(); // Features become null
      expect(licenseStatus.lastChecked).toEqual(lastCheckedDate);
      expect(licenseStatus.isPendingDowngrade).toBe(true);
      expect(mockLoggerError).toHaveBeenCalledWith("Error while checking license: The license check failed");
    });
  });

  describe("getLicenseFeatures", () => {
    test("should return features from cache if available", async () => {
      const cachedResult = { active: true, features: defaultFeatures, lastChecked: new Date() };
      let cacheStore: any = { "getPreviousResult-hashed-test-license-key": cachedResult };
      mockCache.mockImplementation(async (fn, keyArgs) => {
        const key = keyArgs?.[0];
        if (key === "getPreviousResult-hashed-test-license-key") {
          return async () => cacheStore[key] ?? { active: null, lastChecked: new Date(0), features: null };
        }
        // Prevent fetchLicense call
        if (key?.startsWith("fetchLicense")) {
          return async () => ({ data: defaultLicenseDetails }); // Provide data but expect no call
        }
        return async () => await fn();
      });
      vi.resetModules();
      vi.mock("@/lib/cache", () => ({ cache: mockCache, revalidateTag: mockRevalidateTag }));

      const { getLicenseFeatures: getLicenseFeaturesLocal } = await import("./utils");
      const features = await getLicenseFeaturesLocal();
      expect(features).toEqual(defaultFeatures);
      // Check if the underlying fetch mock was called, not the cached fetchLicense
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should fetch features if not in cache", async () => {
      // Simulate empty cache for previous result
      let cacheStore: any = {};
      mockCache.mockImplementation(async (fn, keyArgs) => {
        const key = keyArgs?.[0];
        if (key === "getPreviousResult-hashed-test-license-key") {
          return async () => cacheStore[key] ?? { active: null, lastChecked: new Date(0), features: null };
        }
        // Allow fetchLicense call
        return fn;
      });
      vi.resetModules();
      vi.mock("@/lib/cache", () => ({ cache: mockCache, revalidateTag: mockRevalidateTag }));

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: defaultLicenseDetails }) } as any);
      const { getLicenseFeatures: getLicenseFeaturesLocal } = await import("./utils");
      const features = await getLicenseFeaturesLocal();
      expect(features).toEqual(defaultFeatures);
      expect(mockFetch).toHaveBeenCalledTimes(1); // fetchLicense called
    });

    test("should return null if features not in cache and fetch fails", async () => {
      let cacheStore: any = {}; // Empty cache
      mockCache.mockImplementation(async (fn, keyArgs) => {
        const key = keyArgs?.[0];
        if (key === "getPreviousResult-hashed-test-license-key") {
          return async () => cacheStore[key] ?? { active: null, lastChecked: new Date(0), features: null };
        }
        // Allow fetchLicense call
        return fn;
      });
      vi.resetModules();
      vi.mock("@/lib/cache", () => ({ cache: mockCache, revalidateTag: mockRevalidateTag }));

      mockFetch.mockResolvedValue({ ok: false } as any); // Simulate fetch failure
      const { getLicenseFeatures: getLicenseFeaturesLocal } = await import("./utils");
      const features = await getLicenseFeaturesLocal();
      expect(features).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // Helper function to mock IS_FORMBRICKS_CLOUD
  const mockIsCloud = async (isCloud: boolean) => {
    vi.mock("@/lib/constants", async () => ({
      ...(await vi.importActual("@/lib/constants")),
      ENTERPRISE_LICENSE_KEY: "test-license-key",
      IS_FORMBRICKS_CLOUD: isCloud,
      E2E_TESTING: false,
      IS_RECAPTCHA_CONFIGURED: true,
    }));
    vi.resetModules(); // Ensure the module re-imports constants
  };

  // Helper function to mock E2E_TESTING
  const mockE2E = async (isE2E: boolean) => {
    vi.mock("@/lib/constants", async () => ({
      ...(await vi.importActual("@/lib/constants")),
      ENTERPRISE_LICENSE_KEY: "test-license-key",
      IS_FORMBRICKS_CLOUD: false,
      E2E_TESTING: isE2E,
      IS_RECAPTCHA_CONFIGURED: true,
    }));
    vi.resetModules();
  };

  // Helper to mock license status (active/inactive/error)
  const mockLicenseStatus = async (status: "active" | "inactive" | "error") => {
    if (status === "error") {
      mockFetch.mockResolvedValue({ ok: false } as any);
    } else {
      // Use inactiveLicenseDetails or defaultLicenseDetails based on status
      const details = status === "inactive" ? inactiveLicenseDetails : defaultLicenseDetails;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { ...details, status } }), // Ensure status matches
      } as any);
    }
    vi.resetModules(); // Ensure license check re-runs with new mock
  };

  describe("Permission Functions (Self-Hosted)", () => {
    beforeEach(async () => {
      await mockIsCloud(false); // Set to self-hosted for these tests
    });

    // getRemoveBrandingPermission
    test("getRemoveBrandingPermission: returns true if license active and has feature", async () => {
      await mockLicenseStatus("active");
      const { getRemoveBrandingPermission: getRemoveBrandingPermissionLocal } = await import("./utils");
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanFree)).toBe(true);
    });
    test("getRemoveBrandingPermission: returns false if license inactive", async () => {
      await mockLicenseStatus("inactive");
      const { getRemoveBrandingPermission: getRemoveBrandingPermissionLocal } = await import("./utils");
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanFree)).toBe(false);
    });
    test("getRemoveBrandingPermission: returns false if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getRemoveBrandingPermission: getRemoveBrandingPermissionLocal } = await import("./utils");
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getWhiteLabelPermission
    test("getWhiteLabelPermission: returns true if license active and has feature", async () => {
      await mockLicenseStatus("active");
      const { getWhiteLabelPermission: getWhiteLabelPermissionLocal } = await import("./utils");
      expect(await getWhiteLabelPermissionLocal(mockBillingPlanFree)).toBe(true);
    });
    test("getWhiteLabelPermission: returns false if license inactive", async () => {
      await mockLicenseStatus("inactive");
      const { getWhiteLabelPermission: getWhiteLabelPermissionLocal } = await import("./utils");
      expect(await getWhiteLabelPermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getRoleManagementPermission
    test("getRoleManagementPermission: returns true if license active", async () => {
      await mockLicenseStatus("active");
      const { getRoleManagementPermission: getRoleManagementPermissionLocal } = await import("./utils");
      expect(await getRoleManagementPermissionLocal(mockBillingPlanFree)).toBe(true);
    });
    test("getRoleManagementPermission: returns false if license inactive", async () => {
      await mockLicenseStatus("inactive");
      const { getRoleManagementPermission: getRoleManagementPermissionLocal } = await import("./utils");
      expect(await getRoleManagementPermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getBiggerUploadFileSizePermission
    test("getBiggerUploadFileSizePermission: returns true if license active", async () => {
      await mockLicenseStatus("active");
      const { getBiggerUploadFileSizePermission: getBiggerUploadFileSizePermissionLocal } = await import(
        "./utils"
      );
      expect(await getBiggerUploadFileSizePermissionLocal(mockBillingPlanFree)).toBe(true);
    });
    test("getBiggerUploadFileSizePermission: returns false if license inactive", async () => {
      await mockLicenseStatus("inactive");
      const { getBiggerUploadFileSizePermission: getBiggerUploadFileSizePermissionLocal } = await import(
        "./utils"
      );
      expect(await getBiggerUploadFileSizePermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getMultiLanguagePermission
    test("getMultiLanguagePermission: returns true if license active", async () => {
      await mockLicenseStatus("active");
      const { getMultiLanguagePermission: getMultiLanguagePermissionLocal } = await import("./utils");
      expect(await getMultiLanguagePermissionLocal(mockBillingPlanFree)).toBe(true);
    });
    test("getMultiLanguagePermission: returns false if license inactive", async () => {
      await mockLicenseStatus("inactive");
      const { getMultiLanguagePermission: getMultiLanguagePermissionLocal } = await import("./utils");
      expect(await getMultiLanguagePermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getIsMultiOrgEnabled
    test("getIsMultiOrgEnabled: returns true if license has feature", async () => {
      await mockLicenseStatus("active"); // Ensure features are fetched
      const { getIsMultiOrgEnabled: getIsMultiOrgEnabledLocal } = await import("./utils");
      expect(await getIsMultiOrgEnabledLocal()).toBe(true);
    });
    test("getIsMultiOrgEnabled: returns false if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getIsMultiOrgEnabled: getIsMultiOrgEnabledLocal } = await import("./utils");
      expect(await getIsMultiOrgEnabledLocal()).toBe(false);
    });

    // getIsContactsEnabled
    test("getIsContactsEnabled: returns true if license has feature", async () => {
      await mockLicenseStatus("active");
      const { getIsContactsEnabled: getIsContactsEnabledLocal } = await import("./utils");
      expect(await getIsContactsEnabledLocal()).toBe(true);
    });
    test("getIsContactsEnabled: returns false if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getIsContactsEnabled: getIsContactsEnabledLocal } = await import("./utils");
      expect(await getIsContactsEnabledLocal()).toBe(false);
    });

    // getIsTwoFactorAuthEnabled
    test("getIsTwoFactorAuthEnabled: returns true if license has feature", async () => {
      await mockLicenseStatus("active");
      const { getIsTwoFactorAuthEnabled: getIsTwoFactorAuthEnabledLocal } = await import("./utils");
      expect(await getIsTwoFactorAuthEnabledLocal()).toBe(true);
    });
    test("getIsTwoFactorAuthEnabled: returns false if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getIsTwoFactorAuthEnabled: getIsTwoFactorAuthEnabledLocal } = await import("./utils");
      expect(await getIsTwoFactorAuthEnabledLocal()).toBe(false);
    });

    // getisSsoEnabled
    test("getisSsoEnabled: returns true if license has feature", async () => {
      await mockLicenseStatus("active");
      const { getisSsoEnabled: getisSsoEnabledLocal } = await import("./utils");
      expect(await getisSsoEnabledLocal()).toBe(true);
    });
    test("getisSsoEnabled: returns false if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getisSsoEnabled: getisSsoEnabledLocal } = await import("./utils");
      expect(await getisSsoEnabledLocal()).toBe(false);
    });

    // getIsSamlSsoEnabled
    test("getIsSamlSsoEnabled: returns true if license has SSO and SAML features", async () => {
      await mockLicenseStatus("active");
      const { getIsSamlSsoEnabled: getIsSamlSsoEnabledLocal } = await import("./utils");
      expect(await getIsSamlSsoEnabledLocal()).toBe(true);
    });
    test("getIsSamlSsoEnabled: returns false if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getIsSamlSsoEnabled: getIsSamlSsoEnabledLocal } = await import("./utils");
      expect(await getIsSamlSsoEnabledLocal()).toBe(false);
    });
    test("getIsSamlSsoEnabled: returns false if license missing SAML feature", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { ...defaultLicenseDetails, features: { ...defaultFeatures, saml: false } },
        }),
      } as any);
      vi.resetModules();
      const { getIsSamlSsoEnabled: getIsSamlSsoEnabledLocal } = await import("./utils");
      expect(await getIsSamlSsoEnabledLocal()).toBe(false);
    });

    // getIsSpamProtectionEnabled
    test("getIsSpamProtectionEnabled: returns true if reCAPTCHA configured and license has feature", async () => {
      await mockLicenseStatus("active");
      const { getIsSpamProtectionEnabled: getIsSpamProtectionEnabledLocal } = await import("./utils");
      expect(await getIsSpamProtectionEnabledLocal()).toBe(true);
    });
    test("getIsSpamProtectionEnabled: returns false if reCAPTCHA not configured", async () => {
      vi.mock("@/lib/constants", async () => ({
        ...(await vi.importActual("@/lib/constants")),
        IS_RECAPTCHA_CONFIGURED: false,
        IS_FORMBRICKS_CLOUD: false,
        E2E_TESTING: false,
      }));
      vi.resetModules();
      const { getIsSpamProtectionEnabled: getIsSpamProtectionEnabledLocal } = await import("./utils");
      expect(await getIsSpamProtectionEnabledLocal()).toBe(false);
    });
    test("getIsSpamProtectionEnabled: returns false if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getIsSpamProtectionEnabled: getIsSpamProtectionEnabledLocal } = await import("./utils");
      expect(await getIsSpamProtectionEnabledLocal()).toBe(false);
    });

    // getOrganizationProjectsLimit
    test("getOrganizationProjectsLimit: returns limit from license", async () => {
      await mockLicenseStatus("active");
      const { getOrganizationProjectsLimit: getOrganizationProjectsLimitLocal } = await import("./utils");
      expect(await getOrganizationProjectsLimitLocal(mockBillingLimits)).toBe(10);
    });
    test("getOrganizationProjectsLimit: returns Infinity if license has null projects", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { ...defaultLicenseDetails, features: { ...defaultFeatures, projects: null } },
        }),
      } as any);
      vi.resetModules();
      const { getOrganizationProjectsLimit: getOrganizationProjectsLimitLocal } = await import("./utils");
      expect(await getOrganizationProjectsLimitLocal(mockBillingLimits)).toBe(Infinity);
    });
    test("getOrganizationProjectsLimit: returns 3 if license fetch fails", async () => {
      await mockLicenseStatus("error");
      const { getOrganizationProjectsLimit: getOrganizationProjectsLimitLocal } = await import("./utils");
      expect(await getOrganizationProjectsLimitLocal(mockBillingLimits)).toBe(3);
    });
  });

  describe("Permission Functions (Cloud)", () => {
    beforeEach(async () => {
      await mockIsCloud(true); // Set to cloud for these tests
    });

    // getRemoveBrandingPermission
    test("getRemoveBrandingPermission: returns true for paid plans if enterprise active", async () => {
      await mockLicenseStatus("active"); // Assume cloud enterprise license is active
      const { getRemoveBrandingPermission: getRemoveBrandingPermissionLocal } = await import("./utils");
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanScale)).toBe(true);
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanEnterprise)).toBe(true);
    });
    test("getRemoveBrandingPermission: returns false for free plan even if enterprise active", async () => {
      await mockLicenseStatus("active");
      const { getRemoveBrandingPermission: getRemoveBrandingPermissionLocal } = await import("./utils");
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanFree)).toBe(false);
    });
    test("getRemoveBrandingPermission: returns false if enterprise inactive", async () => {
      await mockLicenseStatus("inactive");
      const { getRemoveBrandingPermission: getRemoveBrandingPermissionLocal } = await import("./utils");
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanScale)).toBe(false);
    });

    // getWhiteLabelPermission (same logic as remove branding for cloud)
    test("getWhiteLabelPermission: returns true for paid plans if enterprise active", async () => {
      await mockLicenseStatus("active");
      const { getWhiteLabelPermission: getWhiteLabelPermissionLocal } = await import("./utils");
      expect(await getWhiteLabelPermissionLocal(mockBillingPlanScale)).toBe(true);
    });
    test("getWhiteLabelPermission: returns false for free plan", async () => {
      await mockLicenseStatus("active");
      const { getWhiteLabelPermission: getWhiteLabelPermissionLocal } = await import("./utils");
      expect(await getWhiteLabelPermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getRoleManagementPermission
    test("getRoleManagementPermission: returns true for Scale and Enterprise plans", async () => {
      const { getRoleManagementPermission: getRoleManagementPermissionLocal } = await import("./utils");
      expect(await getRoleManagementPermissionLocal(mockBillingPlanScale)).toBe(true);
      expect(await getRoleManagementPermissionLocal(mockBillingPlanEnterprise)).toBe(true);
    });
    test("getRoleManagementPermission: returns false for Free plan", async () => {
      const { getRoleManagementPermission: getRoleManagementPermissionLocal } = await import("./utils");
      expect(await getRoleManagementPermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getBiggerUploadFileSizePermission
    test("getBiggerUploadFileSizePermission: returns true for paid plans", async () => {
      const { getBiggerUploadFileSizePermission: getBiggerUploadFileSizePermissionLocal } = await import(
        "./utils"
      );
      expect(await getBiggerUploadFileSizePermissionLocal(mockBillingPlanScale)).toBe(true);
      expect(await getBiggerUploadFileSizePermissionLocal(mockBillingPlanEnterprise)).toBe(true);
    });
    test("getBiggerUploadFileSizePermission: returns false for Free plan", async () => {
      const { getBiggerUploadFileSizePermission: getBiggerUploadFileSizePermissionLocal } = await import(
        "./utils"
      );
      expect(await getBiggerUploadFileSizePermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getMultiLanguagePermission
    test("getMultiLanguagePermission: returns true for Scale and Enterprise plans", async () => {
      const { getMultiLanguagePermission: getMultiLanguagePermissionLocal } = await import("./utils");
      expect(await getMultiLanguagePermissionLocal(mockBillingPlanScale)).toBe(true);
      expect(await getMultiLanguagePermissionLocal(mockBillingPlanEnterprise)).toBe(true);
    });
    test("getMultiLanguagePermission: returns false for Free plan", async () => {
      const { getMultiLanguagePermission: getMultiLanguagePermissionLocal } = await import("./utils");
      expect(await getMultiLanguagePermissionLocal(mockBillingPlanFree)).toBe(false);
    });

    // getIsSamlSsoEnabled
    test("getIsSamlSsoEnabled: always returns false for Cloud", async () => {
      const { getIsSamlSsoEnabled: getIsSamlSsoEnabledLocal } = await import("./utils");
      expect(await getIsSamlSsoEnabledLocal()).toBe(false);
    });

    // getIsSpamProtectionEnabled
    test("getIsSpamProtectionEnabled: always returns false for Cloud", async () => {
      const { getIsSpamProtectionEnabled: getIsSpamProtectionEnabledLocal } = await import("./utils");
      expect(await getIsSpamProtectionEnabledLocal()).toBe(false);
    });

    // getOrganizationProjectsLimit
    test("getOrganizationProjectsLimit: returns limit from billing limits if enterprise active", async () => {
      await mockLicenseStatus("active");
      const { getOrganizationProjectsLimit: getOrganizationProjectsLimitLocal } = await import("./utils");
      expect(await getOrganizationProjectsLimitLocal(mockBillingLimits)).toBe(5);
    });
    test("getOrganizationProjectsLimit: returns Infinity if billing limits has null projects and enterprise active", async () => {
      await mockLicenseStatus("active");
      const { getOrganizationProjectsLimit: getOrganizationProjectsLimitLocal } = await import("./utils");
      // Added missing monthly property
      expect(
        await getOrganizationProjectsLimitLocal({ projects: null, monthly: { responses: null, miu: null } })
      ).toBe(Infinity);
    });
    test("getOrganizationProjectsLimit: returns 3 if enterprise inactive", async () => {
      await mockLicenseStatus("inactive");
      const { getOrganizationProjectsLimit: getOrganizationProjectsLimitLocal } = await import("./utils");
      expect(await getOrganizationProjectsLimitLocal(mockBillingLimits)).toBe(3); // Falls back to license check logic
    });
  });

  describe("Permission Functions (E2E)", () => {
    beforeEach(async () => {
      await mockE2E(true);
    });

    test("getRemoveBrandingPermission returns E2E value", async () => {
      const { getRemoveBrandingPermission: getRemoveBrandingPermissionLocal } = await import("./utils");
      expect(await getRemoveBrandingPermissionLocal(mockBillingPlanFree)).toBe(true); // Based on default E2E features
    });

    test("getWhiteLabelPermission returns E2E value", async () => {
      const { getWhiteLabelPermission: getWhiteLabelPermissionLocal } = await import("./utils");
      expect(await getWhiteLabelPermissionLocal(mockBillingPlanFree)).toBe(true);
    });

    test("getRoleManagementPermission returns E2E value", async () => {
      const { getRoleManagementPermission: getRoleManagementPermissionLocal } = await import("./utils");
      expect(await getRoleManagementPermissionLocal(mockBillingPlanFree)).toBe(true);
    });

    // ... add similar tests for other permission functions checking E2E mode ...

    test("getOrganizationProjectsLimit returns E2E value", async () => {
      const { getOrganizationProjectsLimit: getOrganizationProjectsLimitLocal } = await import("./utils");
      // E2E default projects limit is 3, check against that
      expect(await getOrganizationProjectsLimitLocal(mockBillingLimits)).toBe(3);
    });

    test("getIsSamlSsoEnabled returns E2E value", async () => {
      const { getIsSamlSsoEnabled: getIsSamlSsoEnabledLocal } = await import("./utils");
      expect(await getIsSamlSsoEnabledLocal()).toBe(true); // E2E default has sso and saml
    });
  });
});
