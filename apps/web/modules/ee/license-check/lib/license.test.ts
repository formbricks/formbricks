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
    ENVIRONMENT: "production",
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
  tryLock: vi.fn(),
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
      fetch_lock: (identifier: string) => `fb:license:${identifier}:fetch_lock`,
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
    mockCache.exists.mockReset();
    mockCache.tryLock.mockReset();
    mockCache.withCache.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.info.mockReset();
    mockLogger.debug.mockReset();

    // Set up default mock implementations for Result types
    // fetchLicense uses get with TCachedFetchResult wrapper + distributed lock; getPreviousResult uses get with :previous_result key
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockCache.exists.mockResolvedValue({ ok: true, data: false }); // default: cache miss
    mockCache.tryLock.mockResolvedValue({ ok: true, data: true }); // default: lock acquired
    mockCache.set.mockResolvedValue({ ok: true });

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
      status: "active" as const,
    };

    test("should return cached license from FETCH_LICENSE_CACHE_KEY if available and valid", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Mock cache hit: get returns wrapped license for status key
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: null };
        }
        if (key.includes(":status")) {
          return { ok: true, data: { value: mockFetchedLicenseDetails } };
        }
        return { ok: true, data: null };
      });

      const license = await getEnterpriseLicense();
      expect(license).toEqual(expectedActiveLicenseState);
      expect(mockCache.get).toHaveBeenCalledWith(expect.stringContaining("fb:license:"));
      // Should have checked cache but NOT acquired lock or called fetch
      expect(mockCache.tryLock).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should fetch license if not in FETCH_LICENSE_CACHE_KEY", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Default mocks give cache miss (get returns null)
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFetchedLicenseDetails }),
      } as any);

      const license = await getEnterpriseLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCache.get).toHaveBeenCalledWith(expect.stringContaining("fb:license:"));
      // Should have tried to acquire lock and set the cache
      expect(mockCache.tryLock).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
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

      // Cache miss for fetch (get null, exists false) -> fetch fails -> null
      // getPreviousResult returns previous result for :previous_result key
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: mockPreviousResult };
        }
        return { ok: true, data: null };
      });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const license = await getEnterpriseLicense();

      expect(mockCache.get).toHaveBeenCalled();
      expect(license).toEqual({
        active: true,
        features: mockPreviousResult.features,
        lastChecked: previousTime,
        isPendingDowngrade: true,
        fallbackLevel: "grace" as const,
        status: "unreachable" as const,
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

      // Cache miss -> fetch fails -> null; getPreviousResult returns old previous result
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: mockPreviousResult };
        }
        return { ok: true, data: null };
      });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const license = await getEnterpriseLicense();

      expect(mockCache.get).toHaveBeenCalled();
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
        status: "unreachable" as const,
      });
    });

    test("should return inactive with default features if fetch fails and no previous result (initial fail)", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Cache miss -> fetch fails; no previous result (default get returns null)
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
        status: "unreachable" as const,
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
        status: "no-license" as const,
      });
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(mockCache.exists).not.toHaveBeenCalled();
      expect(mockCache.tryLock).not.toHaveBeenCalled();
    });

    test("should handle fetch throwing an error and use grace period or return inactive", async () => {
      // Runs after "no-license" test which uses vi.doMock; env may have empty key
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Cache miss -> fetch throws -> no previous result -> handleInitialFailure
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const license = await getEnterpriseLicense();
      expect(license).toEqual({
        active: false,
        features: expect.objectContaining({
          isMultiOrgEnabled: false,
          projects: 3,
          removeBranding: false,
        }),
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
        status: "unreachable" as const,
      });
    });

    test("should return invalid_license when API returns 400 (bad license key)", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.get.mockResolvedValue({ ok: true, data: null });
      fetch.mockResolvedValueOnce({ ok: false, status: 400 } as any);

      const license = await getEnterpriseLicense();

      expect(license).toEqual({
        active: false,
        features: expect.objectContaining({ projects: 3 }),
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
        status: "invalid_license" as const,
      });
    });

    test("should skip polling and fetch directly when Redis is unavailable (tryLock error)", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const mockLicense: TEnterpriseLicenseDetails = {
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

      // Redis is down: cache.get returns error, tryLock returns error
      mockCache.get.mockResolvedValue({ ok: false, error: { code: "redis_connection_error" } });
      mockCache.tryLock.mockResolvedValue({ ok: false, error: { code: "redis_connection_error" } });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockLicense }),
      } as any);

      const startTime = Date.now();
      const license = await getEnterpriseLicense();
      const elapsed = Date.now() - startTime;

      // Should NOT have waited for polling — should complete quickly
      expect(elapsed).toBeLessThan(5000);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Redis unavailable during license fetch lock; skipping poll and fetching directly"
      );
      expect(license).toEqual({
        active: true,
        features: mockLicense.features,
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "live" as const,
        status: "active" as const,
      });
    });

    test("should poll and return cached value when another process holds the lock", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const { fetchLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const mockLicense: TEnterpriseLicenseDetails = {
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

      // Lock held by another process (ok: true, data: false)
      mockCache.tryLock.mockResolvedValue({ ok: true, data: false });

      // First get returns cache miss, subsequent gets return the populated license
      let getCalls = 0;
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":status")) {
          getCalls++;
          if (getCalls <= 1) return { ok: true, data: null };
          return { ok: true, data: { value: mockLicense } };
        }
        return { ok: true, data: null };
      });

      const result = await fetchLicense();

      expect(fetch).not.toHaveBeenCalled();
      expect(result).toEqual(mockLicense);
    });

    test("should fall back to direct fetch after poll timeout when lock is held", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const { fetchLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const mockLicense: TEnterpriseLicenseDetails = {
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

      // Lock held, cache never gets populated
      mockCache.tryLock.mockResolvedValue({ ok: true, data: false });
      mockCache.get.mockResolvedValue({ ok: true, data: null });
      mockCache.set.mockResolvedValue({ ok: true });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockLicense }),
      } as any);

      const result = await fetchLicense();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ pollMs: expect.any(Number) }),
        "License cache not populated by holder within poll window; fetching in this process"
      );
      expect(result).toEqual(mockLicense);
    });

    test("should log warning and use short TTL when lock acquired but fetch returns null", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const { fetchLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.get.mockResolvedValue({ ok: true, data: null });
      mockCache.tryLock.mockResolvedValue({ ok: true, data: true });
      mockCache.set.mockResolvedValue({ ok: true });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const result = await fetchLicense();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          ttlMinutes: expect.any(Number),
          timestamp: expect.any(String),
        }),
        "License fetch failed, caching null result with short TTL for faster retry"
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("fb:license:"),
        { value: null },
        10 * 60 * 1000
      );
    });

    test("should return null during build time (NEXT_PHASE = phase-production-build)", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      // eslint-disable-next-line turbo/no-undeclared-env-vars -- NEXT_PHASE is a Next.js env variable
      process.env.NEXT_PHASE = "phase-production-build";

      const { fetchLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const result = await fetchLicense();

      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    test("should return null after poll timeout when fallback fetch also fails", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const { fetchLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.tryLock.mockResolvedValue({ ok: true, data: false });
      mockCache.get.mockResolvedValue({ ok: true, data: null });
      mockCache.set.mockResolvedValue({ ok: true });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      const result = await fetchLicense();

      expect(result).toBeNull();
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("fb:license:"),
        { value: null },
        10 * 60 * 1000
      );
    });
  });

  describe("getLicenseFeatures", () => {
    test("should return features if license is active", async () => {
      vi.resetModules();
      vi.stubGlobal("window", undefined);
      // Mock cache hit for fetchLicense (get returns wrapped license)
      const activeLicenseDetails = {
        status: "active" as const,
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
          multiLanguageSurveys: true,
          accessControl: true,
          quotas: true,
        },
      };
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: null };
        }
        if (key.includes(":status")) {
          return { ok: true, data: { value: activeLicenseDetails } };
        }
        return { ok: true, data: null };
      });

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
        multiLanguageSurveys: true,
        accessControl: true,
        quotas: true,
      });
    });

    test("should return null if license is inactive", async () => {
      const { getLicenseFeatures } = await import("./license");

      // Mock cache hit with expired license wrapped in { value: ... }
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: null };
        }
        if (key.includes(":status")) {
          return {
            ok: true,
            data: {
              value: {
                status: "expired",
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
              },
            },
          };
        }
        return { ok: true, data: null };
      });

      const features = await getLicenseFeatures();
      expect(features).toBeNull();
    });

    test("should return null if getEnterpriseLicense throws", async () => {
      const { getLicenseFeatures } = await import("./license");

      // Mock cache.get to throw so getEnterpriseLicense fails
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
      mockCache.exists.mockReset();
      vi.resetModules();
    });

    test("should use 'browser' as cache key in browser environment", async () => {
      vi.stubGlobal("window", {});

      // Ensure env has license key (previous "no-license" test may have poisoned env)
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      // Cache miss so fetch runs; mock get for cache check
      mockCache.get.mockResolvedValue({ ok: true, data: null });

      const fetch = (await import("node-fetch")).default as Mock;
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: "active",
            features: {
              isMultiOrgEnabled: true,
              projects: 5,
              twoFactorAuth: true,
              sso: true,
              whitelabel: true,
              removeBranding: true,
              contacts: true,
              ai: true,
              saml: true,
              spamProtection: true,
              auditLogs: true,
              multiLanguageSurveys: true,
              accessControl: true,
              quotas: true,
            },
          },
        }),
      } as any);

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
      expect(mockCache.exists).not.toHaveBeenCalled();
    });

    test("should use hashed license key as cache key when ENTERPRISE_LICENSE_KEY is set", async () => {
      vi.resetModules();
      const testLicenseKey = "test-license-key";
      vi.stubGlobal("window", undefined);

      // Ensure env has license key (restore after "no-license" test)
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: testLicenseKey,
          ENVIRONMENT: "production",
          VERCEL_URL: "some.vercel.url",
          FORMBRICKS_COM_URL: "https://app.formbricks.com",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      mockCache.get.mockResolvedValue({ ok: true, data: null });

      const fetch = (await import("node-fetch")).default as Mock;
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: "active",
            features: {
              isMultiOrgEnabled: true,
              projects: 5,
              twoFactorAuth: true,
              sso: true,
              whitelabel: true,
              removeBranding: true,
              contacts: true,
              ai: true,
              saml: true,
              spamProtection: true,
              auditLogs: true,
              multiLanguageSurveys: true,
              accessControl: true,
              quotas: true,
            },
          },
        }),
      } as any);

      const { hashString } = await import("@/lib/hash-string");
      const expectedHash = hashString(testLicenseKey);
      const { getEnterpriseLicense } = await import("./license");
      await getEnterpriseLicense();
      expect(mockCache.get).toHaveBeenCalledWith(
        expect.stringContaining(`fb:license:${expectedHash}:status`)
      );
    });
  });

  describe("Error and Warning Logging", () => {
    beforeEach(() => {
      vi.resetModules();
    });

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

      // Cache hit - fetchLicense returns wrapped cached license
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: null };
        }
        if (key.includes(":status")) {
          return { ok: true, data: { value: mockFetchedLicenseDetails } };
        }
        return { ok: true, data: null };
      });

      // cache.set fails when setPreviousResult tries to save (called for previous_result key)
      mockCache.set.mockResolvedValue({
        ok: false,
        error: new Error("Redis connection failed"),
      });

      await getEnterpriseLicense();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: new Error("Redis connection failed") },
        "Failed to cache previous result"
      );
    });

    test("should log error when trackApiError is called (line 196-203)", async () => {
      const { getEnterpriseLicense } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      // Cache miss -> fetch returns 500
      const mockStatus = 500;
      fetch.mockResolvedValueOnce({
        ok: false,
        status: mockStatus,
        json: async () => ({ error: "Internal Server Error" }),
      } as any);

      await getEnterpriseLicense();

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

      // Cache miss -> fetch returns 403
      const mockStatus = 403;
      fetch.mockResolvedValueOnce({
        ok: false,
        status: mockStatus,
        json: async () => ({ error: "Forbidden" }),
      } as any);

      await getEnterpriseLicense();

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

      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: mockPreviousResult };
        }
        return { ok: true, data: null };
      });

      fetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      await getEnterpriseLicense();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackLevel: "grace",
          timestamp: expect.any(String),
        }),
        expect.stringContaining("Using license fallback level: grace")
      );
    });
  });

  describe("computeFreshLicenseState", () => {
    const mockActiveLicenseDetails: TEnterpriseLicenseDetails = {
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

    beforeEach(() => {
      vi.resetModules();
      vi.resetAllMocks();
      mockCache.get.mockResolvedValue({ ok: true, data: null });
      mockCache.exists.mockResolvedValue({ ok: true, data: false });
      mockCache.set.mockResolvedValue({ ok: true });
    });

    test("should return active license state from pre-fetched active license without calling fetch", async () => {
      const { computeFreshLicenseState } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const result = await computeFreshLicenseState(mockActiveLicenseDetails);

      expect(result).toEqual({
        active: true,
        features: mockActiveLicenseDetails.features,
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "live",
        status: "active",
      });
      // Must not call the license API — the data was passed in directly
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should apply grace period fallback when freshLicense is null and previous result exists within grace", async () => {
      const previousTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const mockPreviousResult = {
        active: true,
        features: { removeBranding: true, projects: 5 },
        lastChecked: previousTime,
      };

      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) {
          return { ok: true, data: mockPreviousResult };
        }
        return { ok: true, data: null };
      });

      const { computeFreshLicenseState } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const result = await computeFreshLicenseState(null);

      expect(result).toEqual({
        active: true,
        features: mockPreviousResult.features,
        lastChecked: previousTime,
        isPendingDowngrade: true,
        fallbackLevel: "grace",
        status: "unreachable",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should return inactive default when freshLicense is null and no previous result", async () => {
      const { computeFreshLicenseState } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      const result = await computeFreshLicenseState(null);

      expect(result).toEqual({
        active: false,
        features: expect.objectContaining({
          isMultiOrgEnabled: false,
          projects: 3,
        }),
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default",
        status: "unreachable",
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should return expired state when freshLicense has expired status", async () => {
      const expiredLicense: TEnterpriseLicenseDetails = {
        status: "expired",
        features: mockActiveLicenseDetails.features,
      };

      const { computeFreshLicenseState } = await import("./license");

      const result = await computeFreshLicenseState(expiredLicense);

      expect(result).toEqual({
        active: false,
        features: expect.objectContaining({
          isMultiOrgEnabled: false,
          projects: 3,
        }),
        lastChecked: expect.any(Date),
        isPendingDowngrade: false,
        fallbackLevel: "default",
        status: "expired",
      });
    });
  });

  describe("clearLicenseCache", () => {
    test("should clear memory cache and delete FETCH_LICENSE_CACHE_KEY", async () => {
      const { clearLicenseCache, getEnterpriseLicense } = await import("./license");
      const activeLicense = {
        status: "active" as const,
        features: {
          isMultiOrgEnabled: true,
          projects: 5,
          twoFactorAuth: true,
          sso: true,
          whitelabel: true,
          removeBranding: true,
          contacts: true,
          ai: true,
          saml: true,
          spamProtection: true,
          auditLogs: true,
          multiLanguageSurveys: true,
          accessControl: true,
          quotas: true,
        },
      };
      mockCache.get.mockImplementation(async (key: string) => {
        if (key.includes(":previous_result")) return { ok: true, data: null };
        if (key.includes(":status")) return { ok: true, data: { value: activeLicense } };
        return { ok: true, data: null };
      });
      mockCache.del.mockResolvedValue({ ok: true });

      await getEnterpriseLicense();
      await clearLicenseCache();

      expect(mockCache.del).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining("fb:license:")])
      );
    });

    test("should log warning when cache.del fails", async () => {
      const { clearLicenseCache } = await import("./license");
      mockCache.del.mockResolvedValue({ ok: false, error: new Error("Redis error") });

      await clearLicenseCache();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: new Error("Redis error") },
        "Failed to delete license cache"
      );
    });
  });

  describe("fetchLicenseFresh", () => {
    test("should fetch directly from server without using cache", async () => {
      const { fetchLicenseFresh } = await import("./license");
      const fetch = (await import("node-fetch")).default as Mock;

      mockCache.get.mockResolvedValue({ ok: true, data: null });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: "active",
            features: {
              isMultiOrgEnabled: true,
              projects: 5,
              twoFactorAuth: true,
              sso: true,
              whitelabel: true,
              removeBranding: true,
              contacts: true,
              ai: true,
              saml: true,
              spamProtection: true,
              auditLogs: true,
              multiLanguageSurveys: true,
              accessControl: true,
              quotas: true,
            },
          },
        }),
      } as any);

      const result = await fetchLicenseFresh();

      expect(result).toEqual(
        expect.objectContaining({
          status: "active",
          features: expect.objectContaining({ projects: 5 }),
        })
      );
      expect(fetch).toHaveBeenCalled();
      expect(mockCache.get).not.toHaveBeenCalled();
    });
  });

  describe("Environment-based endpoint selection", () => {
    test("should use staging endpoint when ENVIRONMENT is staging", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        env: {
          ENTERPRISE_LICENSE_KEY: "test-license-key",
          ENVIRONMENT: "staging",
          HTTPS_PROXY: undefined,
          HTTP_PROXY: undefined,
        },
      }));

      const fetch = (await import("node-fetch")).default as Mock;

      // Cache miss so fetchLicense fetches from server
      mockCache.get.mockResolvedValue({ ok: true, data: null });
      mockCache.exists.mockResolvedValue({ ok: true, data: false });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: "active",
            features: {
              isMultiOrgEnabled: true,
              projects: 5,
              twoFactorAuth: true,
              sso: true,
              whitelabel: true,
              removeBranding: true,
              contacts: true,
              ai: true,
              saml: true,
              spamProtection: true,
              auditLogs: true,
              multiLanguageSurveys: true,
              accessControl: true,
              quotas: true,
            },
          },
        }),
      } as any);

      // Re-import the module to apply the new mock
      const { fetchLicense } = await import("./license");
      await fetchLicense();

      // Verify the staging endpoint was called
      expect(fetch).toHaveBeenCalledWith(
        "https://staging.ee.formbricks.com/api/licenses/check",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });
});
