import { env } from "@/lib/env";
import { hashString } from "@/lib/hashString";
import { getCache } from "@/modules/cache/lib/service";
import {
  TEnterpriseLicenseDetails,
  TEnterpriseLicenseFeatures,
} from "@/modules/ee/license-check/types/enterprise-license";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TOrganizationBillingPlan, ZOrganizationBillingPlan } from "@formbricks/types/organizations";

// Configuration
const CONFIG = {
  CACHE: {
    FETCH_LICENSE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
    PREVIOUS_RESULT_TTL_MS: 4 * 24 * 60 * 60 * 1000, // 4 days
    GRACE_PERIOD_MS: 3 * 24 * 60 * 60 * 1000, // 3 days
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  },
  API: {
    ENDPOINT: "https://ee.formbricks.com/api/licenses/check",
    TIMEOUT_MS: 5000,
  },
} as const;

// Types
type FallbackLevel = "live" | "cached" | "grace" | "default";

type TPreviousResult = {
  active: boolean;
  lastChecked: Date;
  features: TEnterpriseLicenseFeatures | null;
  version: number; // For cache versioning
};

// Validation schemas
const LicenseFeaturesSchema = z.object({
  isMultiOrgEnabled: z.boolean(),
  projects: z.number().nullable(),
  twoFactorAuth: z.boolean(),
  sso: z.boolean(),
  whitelabel: z.boolean(),
  removeBranding: z.boolean(),
  contacts: z.boolean(),
  ai: z.boolean(),
  saml: z.boolean(),
  spamProtection: z.boolean(),
  auditLogs: z.boolean(),
});

const LicenseDetailsSchema = z.object({
  status: z.enum(["active", "expired"]),
  features: LicenseFeaturesSchema,
});

// Error types
class LicenseError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "LicenseError";
  }
}

class LicenseApiError extends LicenseError {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message, "API_ERROR");
    this.name = "LicenseApiError";
  }
}

// Cache keys
const getHashedKey = () => {
  if (typeof window !== "undefined") {
    return "browser"; // Browser environment
  }
  if (!env.ENTERPRISE_LICENSE_KEY) {
    return "no-license"; // No license key provided
  }
  return hashString(env.ENTERPRISE_LICENSE_KEY); // Valid license key
};

export const getCacheKeys = () => {
  const hashedKey = getHashedKey();
  return {
    FETCH_LICENSE_CACHE_KEY: `formbricksEnterpriseLicense-details-${hashedKey}`,
    PREVIOUS_RESULT_CACHE_KEY: `formbricksEnterpriseLicense-previousResult-${hashedKey}`,
  };
};

// Default features
const DEFAULT_FEATURES: TEnterpriseLicenseFeatures = {
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
};

// Helper functions
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const validateConfig = () => {
  const errors: string[] = [];
  if (CONFIG.CACHE.GRACE_PERIOD_MS >= CONFIG.CACHE.PREVIOUS_RESULT_TTL_MS) {
    errors.push("Grace period must be shorter than previous result TTL");
  }
  if (CONFIG.CACHE.MAX_RETRIES < 0) {
    errors.push("Max retries must be non-negative");
  }
  if (errors.length > 0) {
    throw new LicenseError(errors.join(", "), "CONFIG_ERROR");
  }
};

// Cache functions
const getPreviousResult = async (): Promise<TPreviousResult> => {
  if (typeof window !== "undefined") {
    return {
      active: false,
      lastChecked: new Date(0),
      features: DEFAULT_FEATURES,
      version: 1,
    };
  }

  const formbricksCache = getCache();
  const cachedData = await formbricksCache.get<TPreviousResult>(getCacheKeys().PREVIOUS_RESULT_CACHE_KEY);
  if (cachedData) {
    return {
      ...cachedData,
      lastChecked: new Date(cachedData.lastChecked),
    };
  }
  return {
    active: false,
    lastChecked: new Date(0),
    features: DEFAULT_FEATURES,
    version: 1,
  };
};

const setPreviousResult = async (previousResult: TPreviousResult) => {
  if (typeof window !== "undefined") return;

  const formbricksCache = getCache();
  await formbricksCache.set(
    getCacheKeys().PREVIOUS_RESULT_CACHE_KEY,
    previousResult,
    CONFIG.CACHE.PREVIOUS_RESULT_TTL_MS
  );
};

// Monitoring functions
const trackFallbackUsage = (level: FallbackLevel) => {
  logger.info(`Using license fallback level: ${level}`, {
    fallbackLevel: level,
    timestamp: new Date().toISOString(),
  });
};

const trackApiError = (error: LicenseApiError) => {
  logger.error(`License API error: ${error.message}`, {
    status: error.status,
    code: error.code,
    timestamp: new Date().toISOString(),
  });
};

// Validation functions
const validateFallback = (previousResult: TPreviousResult): boolean => {
  if (!previousResult.features) return false;
  if (previousResult.lastChecked.getTime() === new Date(0).getTime()) return false;
  if (previousResult.version !== 1) return false; // Add version check
  return true;
};

const validateLicenseDetails = (data: unknown): TEnterpriseLicenseDetails => {
  return LicenseDetailsSchema.parse(data);
};

// Fallback functions
const getFallbackLevel = (
  liveLicense: TEnterpriseLicenseDetails | null,
  previousResult: TPreviousResult,
  currentTime: Date
): FallbackLevel => {
  if (liveLicense) return "live";
  if (previousResult.active) {
    const elapsedTime = currentTime.getTime() - previousResult.lastChecked.getTime();
    return elapsedTime < CONFIG.CACHE.GRACE_PERIOD_MS ? "grace" : "default";
  }
  return "default";
};

const handleInitialFailure = async (currentTime: Date) => {
  const initialFailResult: TPreviousResult = {
    active: false,
    features: DEFAULT_FEATURES,
    lastChecked: currentTime,
    version: 1,
  };
  await setPreviousResult(initialFailResult);
  return {
    active: false,
    features: DEFAULT_FEATURES,
    lastChecked: currentTime,
    isPendingDowngrade: false,
    fallbackLevel: "default" as const,
  };
};

// API functions
const fetchLicenseFromServerInternal = async (retryCount = 0): Promise<TEnterpriseLicenseDetails | null> => {
  if (!env.ENTERPRISE_LICENSE_KEY) return null;

  // Skip license checks during build time
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- NEXT_PHASE is a next.js env variable
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    // first millisecond of next year => current year is fully included
    const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

    const responseCount = await prisma.response.count({
      where: {
        createdAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
    });

    const proxyUrl = env.HTTPS_PROXY ?? env.HTTP_PROXY;
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT_MS);

    const res = await fetch(CONFIG.API.ENDPOINT, {
      body: JSON.stringify({
        licenseKey: env.ENTERPRISE_LICENSE_KEY,
        usage: { responseCount },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      agent,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const responseJson = (await res.json()) as { data: unknown };
      return validateLicenseDetails(responseJson.data);
    }

    const error = new LicenseApiError(`License check API responded with status: ${res.status}`, res.status);
    trackApiError(error);

    // Retry on specific status codes
    if (retryCount < CONFIG.CACHE.MAX_RETRIES && [429, 502, 503, 504].includes(res.status)) {
      await sleep(CONFIG.CACHE.RETRY_DELAY_MS * Math.pow(2, retryCount));
      return fetchLicenseFromServerInternal(retryCount + 1);
    }

    return null;
  } catch (error) {
    if (error instanceof LicenseApiError) {
      throw error;
    }
    logger.error(error, "Error while fetching license from server");
    return null;
  }
};

export const fetchLicense = async (): Promise<TEnterpriseLicenseDetails | null> => {
  if (!env.ENTERPRISE_LICENSE_KEY) return null;

  const formbricksCache = getCache();
  const cachedLicense = await formbricksCache.get<TEnterpriseLicenseDetails>(
    getCacheKeys().FETCH_LICENSE_CACHE_KEY
  );

  if (cachedLicense) {
    return cachedLicense;
  }

  const licenseDetails = await fetchLicenseFromServerInternal();

  if (licenseDetails) {
    await formbricksCache.set(
      getCacheKeys().FETCH_LICENSE_CACHE_KEY,
      licenseDetails,
      CONFIG.CACHE.FETCH_LICENSE_TTL_MS
    );
  }
  return licenseDetails;
};

export const getEnterpriseLicense = reactCache(
  async (): Promise<{
    active: boolean;
    features: TEnterpriseLicenseFeatures | null;
    lastChecked: Date;
    isPendingDowngrade: boolean;
    fallbackLevel: FallbackLevel;
  }> => {
    validateConfig();

    if (!env.ENTERPRISE_LICENSE_KEY || env.ENTERPRISE_LICENSE_KEY.length === 0) {
      return {
        active: false,
        features: null,
        lastChecked: new Date(),
        isPendingDowngrade: false,
        fallbackLevel: "default" as const,
      };
    }

    const currentTime = new Date();
    const liveLicenseDetails = await fetchLicense();
    const previousResult = await getPreviousResult();
    const fallbackLevel = getFallbackLevel(liveLicenseDetails, previousResult, currentTime);

    trackFallbackUsage(fallbackLevel);

    let currentLicenseState: TPreviousResult | undefined;

    switch (fallbackLevel) {
      case "live":
        if (!liveLicenseDetails) throw new Error("Invalid state: live license expected");
        currentLicenseState = {
          active: liveLicenseDetails.status === "active",
          features: liveLicenseDetails.features,
          lastChecked: currentTime,
          version: 1,
        };
        await setPreviousResult(currentLicenseState);
        return {
          active: currentLicenseState.active,
          features: currentLicenseState.features,
          lastChecked: currentTime,
          isPendingDowngrade: false,
          fallbackLevel: "live" as const,
        };

      case "grace":
        if (!validateFallback(previousResult)) {
          return handleInitialFailure(currentTime);
        }
        return {
          active: previousResult.active,
          features: previousResult.features,
          lastChecked: previousResult.lastChecked,
          isPendingDowngrade: true,
          fallbackLevel: "grace" as const,
        };

      case "default":
        return handleInitialFailure(currentTime);
    }

    return handleInitialFailure(currentTime);
  }
);

export const getLicenseFeatures = async (): Promise<TEnterpriseLicenseFeatures | null> => {
  try {
    const licenseState = await getEnterpriseLicense();
    return licenseState.active ? licenseState.features : null;
  } catch (e) {
    logger.error(e, "Error getting license features");
    return null;
  }
};

export const getOrganizationPlan = reactCache(
  async (organizationId: string): Promise<TOrganizationBillingPlan | undefined> => {
    try {
      const cache = getCache();
      const cacheKey = `organization-plan-${organizationId}`;
      let plan = await cache.get<string>(cacheKey);
      let isValid = !!plan;

      if (!plan) {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { billing: true },
        });

        plan = org?.billing?.plan ?? null;
        isValid = !!plan && ZOrganizationBillingPlan.safeParse(plan).success;

        if (isValid) {
          await cache.set(cacheKey, plan, CONFIG.CACHE.FETCH_LICENSE_TTL_MS);
        }
      }

      return isValid ? (plan as TOrganizationBillingPlan) : undefined;
    } catch (e) {
      logger.error(e, "Error getting organization plan");
      return undefined;
    }
  }
);

// All permission checking functions and their helpers have been moved to utils.ts
