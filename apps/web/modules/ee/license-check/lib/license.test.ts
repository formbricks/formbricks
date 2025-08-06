import {
  TEnterpriseLicenseDetails,
  TEnterpriseLicenseFeatures,
} from "@/modules/ee/license-check/types/enterprise-license";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import { prisma } from "@formbricks/database";

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
  getCache: () => Promise.resolve(mockCache),
}));

// Mock the createCacheKey functions
vi.mock("@/modules/cache/lib/cacheKeys", () => ({
  createCacheKey: {
    license: {
      status: (identifier: string) => `fb:license:${identifier}:status`,
      previous_result: (identifier: string) => `fb:license:${identifier}:previous_result`,
    },
    custom: (namespace: string, identifier: string, subResource?: string) => {
      const base = `fb:${namespace}:${identifier}`;
      return subResource ? `${base}:${subResource}` : base;
    },
  },
}));

vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      count: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
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
      auditLogs: true,
      multiLanguageSurveys: true,
      accessControl: true,
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
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("fb:license:") && key.endsWith(":status")) {
          return mockFetchedLicenseDetails;
        }
        return null;
      });

      const license = await getEnterpriseLicense();
      expect(license).toEqual(expectedActiveLicenseState);
      expect(mockCache.get).toHaveBeenCalledWith(expect.stringContaining("fb:license:"));
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should fetch license if not in FETCH_LICENSE_CACHE_KEY", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.get.mockResolvedValue(null);
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFetchedLicenseDetails }),
      } as any);

      const license = await getEnterpriseLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("fb:license:"),
        mockFetchedLicenseDetails,
        expect.any(Number)
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("fb:license:"),
        {
          active: true,
          features: mockFetchedLicenseDetails.features,
          lastChecked: expect.any(Date),
        },
        expect.any(Number)
      );
      expect(license).toEqual(expectedActiveLicenseState);
    });

    test("should use previous result if fetch fails and previous result exists and is within grace period", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const previousTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago, within grace period
      const mockPreviousResult = {
        active: true,
        features: { removeBranding: true, projects: 5 },
        lastChecked: previousTime,
        version: 1,
      };
      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("fb:license:") && key.endsWith(":status")) return null;
        if (key.startsWith("fb:license:") && key.includes(":previous_result")) return mockPreviousResult;
        return null;
      });
      (fetch as Mock).mockResolvedValueOnce({ ok: false, status: 500 } as any);

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
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const previousTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago, outside grace period
      const mockPreviousResult = {
        active: true,
        features: { removeBranding: true },
        lastChecked: previousTime,
        version: 1,
      };
      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("fb:license:") && key.endsWith(":status")) return null;
        if (key.startsWith("fb:license:") && key.includes(":previous_result")) return mockPreviousResult;
        return null;
      });
      (fetch as Mock).mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const license = await getEnterpriseLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("fb:license:"),
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
            auditLogs: false,
            multiLanguageSurveys: false,
            accessControl: false,
          },
          lastChecked: expect.any(Date),
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
          auditLogs: false,
          multiLanguageSurveys: false,
          accessControl: false,
        },
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
      });
    });

    test("should return inactive with default features if fetch fails and no previous result (initial fail)", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.get.mockResolvedValue(null);
      (fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

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
        auditLogs: false,
        multiLanguageSurveys: false,
        accessControl: false,
      };
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("fb:license:"),
        {
          active: false,
          features: expectedFeatures,
          lastChecked: expect.any(Date),
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
      const fetch = (await import("node-fetch")).default as Mock;
      fetch.mockReset();

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
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    test("should handle fetch throwing an error and use grace period or return inactive", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.get.mockResolvedValue(null);
      (fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

      const license = await getEnterpriseLicense();
      expect(license).toEqual({
        active: false,
        features: null,
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
      });
    });
  });

  describe("getLicenseFeatures", () => {
    test("should return features if license is active", async () => {
      // Set up environment before import
      vi.stubGlobal("window", undefined);
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));
      // Import hashString to compute the expected cache key
      const { hashString } = await import("@/lib/hash-string");
      const hashedKey = hashString("test-license-key");
      const detailsKey = `fb:license:${hashedKey}:status`;
      // Patch the cache mock to match the actual key logic
      mockCache.get.mockImplementation(async (key) => {
        if (key === detailsKey) {
          return {
            status: "active",
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
              auditLogs: true,
            },
          };
        }
        return null;
      });
      // Import after env and mocks are set
      const { getLicenseFeatures } = await import("./license");
      const features = await getLicenseFeatures();
      expect(features).toEqual({
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
        auditLogs: true,
      });
    });

    test("should return null if license is inactive", async () => {
      const { getLicenseFeatures } = await import("./license");
      mockCache.get.mockImplementation(async (key) => {
        if (key.startsWith("fb:license:") && key.endsWith(":status")) {
          return { status: "expired", features: null };
        }
        return null;
      });

      const features = await getLicenseFeatures();
      expect(features).toBeNull();
    });

    test("should return null if getEnterpriseLicense throws", async () => {
      const { getLicenseFeatures } = await import("./license");
      mockCache.get.mockRejectedValue(new Error("Cache error"));

      const features = await getLicenseFeatures();
      expect(features).toBeNull();
    });
  });

  describe("Cache Key Generation", () => {
    beforeEach(() => {
      vi.resetAllMocks();
      mockCache.get.mockReset();
      mockCache.set.mockReset();
      mockCache.del.mockReset();
      vi.resetModules();
    });

    test("should use 'browser' as cache key in browser environment", async () => {
      vi.stubGlobal("window", {});
      const { getEnterpriseLicense } = await import("./license");
      await getEnterpriseLicense();
      expect(mockCache.get).toHaveBeenCalledWith(expect.stringContaining("fb:license:browser:status"));
    });

    test("should use 'no-license' as cache key when ENTERPRISE_LICENSE_KEY is not set", async () => {
      vi.resetModules();
      vi.stubGlobal("window", undefined);
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: undefined,
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));
      const { getEnterpriseLicense } = await import("./license");
      await getEnterpriseLicense();
      // The cache should NOT be accessed if there is no license key
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    test("should use hashed license key as cache key when ENTERPRISE_LICENSE_KEY is set", async () => {
      vi.resetModules();
      const testLicenseKey = "test-license-key";
      vi.stubGlobal("window", undefined);
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: testLicenseKey,
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));
      const { hashString } = await import("@/lib/hash-string");
      const expectedHash = hashString(testLicenseKey);
      const { getEnterpriseLicense } = await import("./license");
      await getEnterpriseLicense();
      expect(mockCache.get).toHaveBeenCalledWith(
        expect.stringContaining(`fb:license:${expectedHash}:status`)
      );
    });
  });
});
