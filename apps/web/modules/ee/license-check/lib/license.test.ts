import {
  TEnterpriseLicenseDetails,
  TEnterpriseLicenseFeatures,
} from "@/modules/ee/license-check/types/enterprise-license";
import fetch from "node-fetch";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getEnterpriseLicense, getLicenseFeatures } from "./license";

// Mock declarations must be at the top level
vi.mock("@/lib/env", () => ({
  env: {
    ENTERPRISE_LICENSE_KEY: "test-license-key",
    VERCEL_URL: "some.vercel.url",
    FORMBRICKS_COM_URL: "https://app.formbricks.com",
    HTTPS_PROXY: undefined,
    HTTP_PROXY: undefined,
  },
}));

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  reset: vi.fn(),
  store: { name: "memory" },
};

vi.mock("@/modules/cache/lib/service", () => ({
  getCache: () => mockCache,
}));

vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      count: vi.fn(),
    },
  },
}));

// Mock constants as they are used in the original license.ts indirectly
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(typeof actual === "object" && actual !== null ? actual : {}),
    IS_FORMBRICKS_CLOUD: false, // Default to self-hosted for most tests
    REVALIDATION_INTERVAL: 3600, // Example value
    ENTERPRISE_LICENSE_KEY: "test-license-key",
  };
});

describe("License Core Logic", () => {
  let originalProcessEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalProcessEnv = { ...process.env };
    vi.resetAllMocks();
    mockCache.get.mockReset();
    mockCache.set.mockReset();
    mockCache.del.mockReset();
    vi.mocked(prisma.response.count).mockResolvedValue(100);
    vi.clearAllMocks();
    // Mock window to be undefined for server-side tests
    vi.stubGlobal("window", undefined);
  });

  afterEach(() => {
    process.env = originalProcessEnv;
    vi.unstubAllGlobals();
  });

  describe("getEnterpriseLicense", () => {
    const mockFetchedLicenseDetailsFeatures: TEnterpriseLicenseFeatures = {
      isMultiOrgEnabled: true,
      contacts: true,
      projects: 10,
      whitelabel: true,
      removeBranding: true,
      twoFactorAuth: true,
      sso: true,
      saml: true,
      spamProtection: true,
      ai: false,
    };
    const mockFetchedLicenseDetails: TEnterpriseLicenseDetails = {
      status: "active",
      features: mockFetchedLicenseDetailsFeatures,
    };

    const expectedActiveLicenseState = {
      active: true,
      features: mockFetchedLicenseDetails.features,
      lastChecked: expect.any(Date),
      isPendingDowngrade: false,
      fallbackLevel: "live" as const,
    };

    test("should return cached license from FETCH_LICENSE_CACHE_KEY if available and valid", async () => {
      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("formbricksEnterpriseLicense-details")) {
          return mockFetchedLicenseDetails;
        }
        return null;
      });

      const license = await getEnterpriseLicense();
      expect(license).toEqual(expectedActiveLicenseState);
      expect(mockCache.get).toHaveBeenCalledWith(
        expect.stringContaining("formbricksEnterpriseLicense-details")
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should fetch license if not in FETCH_LICENSE_CACHE_KEY", async () => {
      mockCache.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFetchedLicenseDetails }),
      } as any);

      const license = await getEnterpriseLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("formbricksEnterpriseLicense-details"),
        mockFetchedLicenseDetails,
        expect.any(Number)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("formbricksEnterpriseLicense-previousResult"),
        {
          active: true,
          features: mockFetchedLicenseDetails.features,
          lastChecked: expect.any(Date),
          version: 1,
        },
        expect.any(Number)
      );
      expect(license).toEqual(expectedActiveLicenseState);
    });

    test("should use previous result if fetch fails and previous result exists and is within grace period", async () => {
      const previousTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago, within grace period
      const mockPreviousResult = {
        active: true,
        features: { removeBranding: true, projects: 5 },
        lastChecked: previousTime,
        version: 1,
      };
      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("formbricksEnterpriseLicense-details")) return null;
        if (key.startsWith("formbricksEnterpriseLicense-previousResult")) return mockPreviousResult;
        return null;
      });
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const license = await getEnterpriseLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(license).toEqual({
        active: true,
        features: mockPreviousResult.features,
        lastChecked: previousTime,
        isPendingDowngrade: true,
        fallbackLevel: "grace" as const,
      });
    });

    test("should return inactive and set new previousResult if fetch fails and previous result is outside grace period", async () => {
      const previousTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago, outside grace period
      const mockPreviousResult = {
        active: true,
        features: { removeBranding: true },
        lastChecked: previousTime,
        version: 1,
      };
      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("formbricksEnterpriseLicense-details")) return null;
        if (key.startsWith("formbricksEnterpriseLicense-previousResult")) return mockPreviousResult;
        return null;
      });
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const license = await getEnterpriseLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("formbricksEnterpriseLicense-previousResult"),
        {
          active: false,
          features: {
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
          },
          lastChecked: expect.any(Date),
          version: 1,
        },
        expect.any(Number)
      );
      expect(license).toEqual({
        active: false,
        features: {
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
        },
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
      });
    });

    test("should return inactive with default features if fetch fails and no previous result (initial fail)", async () => {
      mockCache.get.mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const { getEnterpriseLicense } = await import("./license");
      const license = await getEnterpriseLicense();
      const expectedFeatures: TEnterpriseLicenseFeatures = {
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
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("formbricksEnterpriseLicense-previousResult"),
        {
          active: false,
          features: expectedFeatures,
          lastChecked: expect.any(Date),
          version: 1,
        },
        expect.any(Number)
      );
      expect(license).toEqual({
        active: false,
        features: expectedFeatures,
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
      });
    });

    test("should return inactive license if ENTERPRISE_LICENSE_KEY is not set in env", async () => {
      // Reset all mocks first
      vi.resetAllMocks();
      mockCache.get.mockReset();
      mockCache.set.mockReset();

      // Mock the env module with empty license key
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      // Re-import the module to apply the new mock
      const { getEnterpriseLicense } = await import("./license");
      const license = await getEnterpriseLicense();

      expect(license).toEqual({
        active: false,
        features: null,
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    test("should handle fetch throwing an error and use grace period or return inactive", async () => {
      mockCache.get.mockResolvedValue(null);
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const license = await getEnterpriseLicense();
      expect(license.active).toBe(false);
      expect(license.features).not.toBeUndefined();
      expect(license.lastChecked).toEqual(expect.any(Date));
      expect(license.fallbackLevel).toBe("default");
    });
  });

  describe("getLicenseFeatures", () => {
    test("should return features if license is active", async () => {
      const activeLicenseResult = {
        active: true,
        features: {
          isMultiOrgEnabled: true,
          contacts: true,
          projects: 5,
          whitelabel: true,
          removeBranding: true,
          twoFactorAuth: true,
          sso: true,
          saml: true,
          spamProtection: true,
          ai: true,
        },
        lastChecked: new Date(),
        fallbackLevel: "live" as const,
      };

      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("formbricksEnterpriseLicense-details")) {
          return { status: "active", features: activeLicenseResult.features };
        }
        return null;
      });

      const features = await getLicenseFeatures();
      expect(features).toEqual(activeLicenseResult.features);
    });

    test("should return null if license is inactive", async () => {
      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("formbricksEnterpriseLicense-details")) {
          return { status: "expired", features: null };
        }
        return null;
      });

      const features = await getLicenseFeatures();
      expect(features).toBeNull();
    });

    test("should return null if getEnterpriseLicense throws", async () => {
      mockCache.get.mockRejectedValue(new Error("Cache error"));

      const features = await getLicenseFeatures();
      expect(features).toBeNull();
    });
  });
});

// Helper mock for process.env if not already globally available in test environment
if (typeof process === "undefined") {
  global.process = { env: {} } as any;
}
vi.stubGlobal("process", global.process);
