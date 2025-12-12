import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import { prisma } from "@formbricks/database";
import { getInstanceId, getInstanceInfo } from "@/lib/instance";
import {
  TEnterpriseLicenseDetails,
  TEnterpriseLicenseFeatures,
} from "@/modules/ee/license-check/types/enterprise-license";

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
  exists: vi.fn(),
  withCache: vi.fn(),
  getRedisClient: vi.fn(),
};

vi.mock("@/lib/cache", () => ({
  cache: mockCache,
}));

// Mock the createCacheKey functions
vi.mock("@formbricks/cache", () => ({
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
      findFirst: vi.fn(),
    },
  },
}));

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@formbricks/logger", () => ({
  logger: mockLogger,
}));

vi.mock("@/lib/instance", () => ({
  getInstanceId: vi.fn(),
  getInstanceInfo: vi.fn(),
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
    mockCache.withCache.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.info.mockReset();
    mockLogger.debug.mockReset();

    // Set up default mock implementations for Result types
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockCache.set.mockResolvedValue({ ok: true });
    mockCache.withCache.mockImplementation(async (fn) => await fn());

    vi.mocked(prisma.response.count).mockResolvedValue(100);
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: "test-org-id",
      createdAt: new Date("2024-01-01"),
    } as any);
    vi.mocked(getInstanceId).mockResolvedValue("test-hashed-instance-id");
    vi.mocked(getInstanceInfo).mockResolvedValue({
      instanceId: "test-hashed-instance-id",
      createdAt: new Date("2024-01-01"),
    });
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
      quotas: true,
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

      // Mock cache.withCache to return cached license details (simulating cache hit)
      mockCache.withCache.mockResolvedValue(mockFetchedLicenseDetails);

      const license = await getEnterpriseLicense();
      expect(license).toEqual(expectedActiveLicenseState);
      expect(mockCache.withCache).toHaveBeenCalledWith(
        expect.any(Function),
        expect.stringContaining("fb:license:"),
        expect.any(Number)
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should fetch license if not in FETCH_LICENSE_CACHE_KEY", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Mock cache.withCache to execute the function (simulating cache miss)
      mockCache.withCache.mockImplementation(async (fn) => await fn());

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFetchedLicenseDetails }),
      } as any);

      const license = await getEnterpriseLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCache.withCache).toHaveBeenCalledWith(
        expect.any(Function),
        expect.stringContaining("fb:license:"),
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

      // Mock cache.withCache to return null (simulating fetch failure)
      mockCache.withCache.mockResolvedValue(null);

      // Mock cache.get to return previous result when requested
      mockCache.get.mockImplementation(async (key) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: mockPreviousResult };
        }
        return { ok: true, data: null };
      });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const license = await getEnterpriseLicense();

      expect(mockCache.withCache).toHaveBeenCalled();
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

      // Mock cache.withCache to return null (simulating fetch failure)
      mockCache.withCache.mockResolvedValue(null);

      // Mock cache.get to return previous result when requested
      mockCache.get.mockImplementation(async (key) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: mockPreviousResult };
        }
        return { ok: true, data: null };
      });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const license = await getEnterpriseLicense();

      expect(mockCache.withCache).toHaveBeenCalled();
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
            quotas: false,
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
          quotas: false,
        },
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
      });
    });

    test("should return inactive with default features if fetch fails and no previous result (initial fail)", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Mock cache.withCache to return null (simulating fetch failure)
      mockCache.withCache.mockResolvedValue(null);

      // Mock cache.get to return no previous result
      mockCache.get.mockResolvedValue({ ok: true, data: null });

      fetch.mockRejectedValueOnce(new Error("Network error"));

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
        quotas: false,
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
      mockCache.withCache.mockReset();
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
      expect(mockCache.withCache).not.toHaveBeenCalled();
    });

    test("should handle fetch throwing an error and use grace period or return inactive", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Mock cache.withCache to return null (simulating fetch failure)
      mockCache.withCache.mockResolvedValue(null);

      // Mock cache.get to return no previous result
      mockCache.get.mockResolvedValue({ ok: true, data: null });

      fetch.mockRejectedValueOnce(new Error("Network error"));

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
      // Mock cache.withCache to return license details
      mockCache.withCache.mockResolvedValue({
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

      // Mock cache.withCache to return expired license
      mockCache.withCache.mockResolvedValue({ status: "expired", features: null });

      const features = await getLicenseFeatures();
      expect(features).toBeNull();
    });

    test("should return null if getEnterpriseLicense throws", async () => {
      const { getLicenseFeatures } = await import("./license");

      // Mock cache.withCache to throw an error
      mockCache.withCache.mockRejectedValue(new Error("Cache error"));

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
      mockCache.withCache.mockReset();
      vi.resetModules();
    });

    test("should use 'browser' as cache key in browser environment", async () => {
      vi.stubGlobal("window", {});

      // Set up default mock for cache.withCache
      mockCache.withCache.mockImplementation(async (fn) => await fn());

      const { getEnterpriseLicense } = await import("./license");
      await getEnterpriseLicense();
      expect(mockCache.withCache).toHaveBeenCalledWith(
        expect.any(Function),
        expect.stringContaining("fb:license:browser:status"),
        expect.any(Number)
      );
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
      expect(mockCache.withCache).not.toHaveBeenCalled();
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

      // Set up default mock for cache.withCache
      mockCache.withCache.mockImplementation(async (fn) => await fn());

      const { hashString } = await import("@/lib/hash-string");
      const expectedHash = hashString(testLicenseKey);
      const { getEnterpriseLicense } = await import("./license");
      await getEnterpriseLicense();
      expect(mockCache.withCache).toHaveBeenCalledWith(
        expect.any(Function),
        expect.stringContaining(`fb:license:${expectedHash}:status`),
        expect.any(Number)
      );
    });
  });

  describe("Error and Warning Logging", () => {
    test("should log warning when setPreviousResult cache.set fails (line 176-178)", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const mockFetchedLicenseDetails: TEnterpriseLicenseDetails = {
        status: "active",
        features: {
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
          quotas: true,
        },
      };

      // Mock successful fetch from API
      mockCache.withCache.mockResolvedValue(mockFetchedLicenseDetails);

      // Mock cache.set to fail when saving previous result
      mockCache.set.mockResolvedValue({
        ok: false,
        error: new Error("Redis connection failed"),
      });

      await getEnterpriseLicense();

      // Verify that the warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: new Error("Redis connection failed") },
        "Failed to cache previous result"
      );
    });

    test("should log error when trackApiError is called (line 196-203)", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Mock cache.withCache to execute the function (simulating cache miss)
      mockCache.withCache.mockImplementation(async (fn) => await fn());

      // Mock API response with 500 status
      const mockStatus = 500;
      fetch.mockResolvedValueOnce({
        ok: false,
        status: mockStatus,
        json: async () => ({ error: "Internal Server Error" }),
      } as any);

      await getEnterpriseLicense();

      // Verify that the API error was logged with correct structure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          status: mockStatus,
          code: "API_ERROR",
          timestamp: expect.any(String),
        }),
        expect.stringContaining("License API error:")
      );
    });

    test("should log error when trackApiError is called with different status codes (line 196-203)", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Test with 403 Forbidden
      mockCache.withCache.mockImplementation(async (fn) => await fn());
      const mockStatus = 403;
      fetch.mockResolvedValueOnce({
        ok: false,
        status: mockStatus,
        json: async () => ({ error: "Forbidden" }),
      } as any);

      await getEnterpriseLicense();

      // Verify that the API error was logged with correct structure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          status: mockStatus,
          code: "API_ERROR",
          timestamp: expect.any(String),
        }),
        expect.stringContaining("License API error:")
      );
    });

    test("should log info when trackFallbackUsage is called during grace period", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const previousTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const mockPreviousResult = {
        active: true,
        features: { removeBranding: true, projects: 5 },
        lastChecked: previousTime,
        version: 1,
      };

      mockCache.withCache.mockResolvedValue(null);
      mockCache.get.mockImplementation(async (key) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: mockPreviousResult };
        }
        return { ok: true, data: null };
      });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      await getEnterpriseLicense();

      // Verify that the fallback info was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackLevel: "grace",
          timestamp: expect.any(String),
        }),
        expect.stringContaining("Using license fallback level: grace")
      );
    });
  });
});
