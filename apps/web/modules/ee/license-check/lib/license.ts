import "server-only";
import { cache as reactCache } from "react";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { env } from "@/lib/env";
import {
  TEnterpriseLicenseDetails,
  TEnterpriseLicenseFeatures,
  TLicenseStatus,
} from "@/modules/ee/license-check/types/enterprise-license";
import { CONFIG, DEFAULT_FEATURES, LicenseApiError, LicenseError, getCacheKeys } from "./license-config";
import { fetchLicense } from "./license-fetch";
import { type TLicenseRefusalStatus, isLicenseRefusalStatus } from "./license-status";

export { LicenseApiError, getCacheKeys } from "./license-config";
export { fetchLicense, fetchLicenseFresh } from "./license-fetch";

export const GRACE_PERIOD_MS = CONFIG.CACHE.GRACE_PERIOD_MS;

/**
 * Grace-period view of a license's last successful check, for the pending-downgrade banner.
 *
 * The clock is read here rather than in the banner: the banner is a client component rendered on
 * both the server pass and hydration, so a `Date.now()` comparison there is impure and can disagree
 * with itself across the two passes (ENG-2366). Keeping it here also means the 3-day window has a
 * single definition — the banner used to carry its own copy of the constant, which would silently
 * drift from the real grace period.
 */
export const getPendingDowngradeSchedule = (
  lastChecked: Date
): { isWithinGracePeriod: boolean; scheduledDowngradeDate: Date } => ({
  isWithinGracePeriod: Date.now() - lastChecked.getTime() < GRACE_PERIOD_MS,
  scheduledDowngradeDate: new Date(lastChecked.getTime() + GRACE_PERIOD_MS),
});

/** TTL in ms for successful license fetch results (24h). Re-export for use in actions. */
export const FETCH_LICENSE_TTL_MS = CONFIG.CACHE.FETCH_LICENSE_TTL_MS;
/** TTL in ms for failed license fetch results (10 min). Re-export for use in actions. */
export const FAILED_FETCH_TTL_MS = CONFIG.CACHE.FAILED_FETCH_TTL_MS;

// Types
type FallbackLevel = "live" | "cached" | "grace" | "default";

type TEnterpriseLicenseResult = {
  active: boolean;
  features: TEnterpriseLicenseFeatures | null;
  lastChecked: Date;
  isPendingDowngrade: boolean;
  fallbackLevel: FallbackLevel;
  status: TLicenseStatus;
};

type TPreviousResult = {
  active: boolean;
  lastChecked: Date;
  features: TEnterpriseLicenseFeatures | null;
  // The license server's last answer when it refused the license after `lastChecked` (the last active
  // answer); cleared by the next active one. While the server is unreachable, grace reports this instead
  // of "unreachable", so a refusal is not forgotten the moment a later check fails (ENG-7563).
  lastRefusal?: TLicenseRefusalStatus;
};

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

// Cache functions with async pattern
let getPreviousResultPromise: Promise<TPreviousResult> | null = null;

const getPreviousResult = async (): Promise<TPreviousResult> => {
  if (getPreviousResultPromise) return getPreviousResultPromise;

  getPreviousResultPromise = (async () => {
    if (globalThis.window !== undefined) {
      return {
        active: false,
        lastChecked: new Date(0),
        features: DEFAULT_FEATURES,
      };
    }

    try {
      const result = await cache.get<TPreviousResult>(getCacheKeys().PREVIOUS_RESULT_CACHE_KEY);
      if (result.ok && result.data) {
        return {
          ...result.data,
          lastChecked: new Date(result.data.lastChecked),
          lastRefusal: isLicenseRefusalStatus(result.data.lastRefusal) ? result.data.lastRefusal : undefined,
        };
      }
    } catch (error) {
      logger.error({ error }, "Failed to get previous result from cache");
    }

    return {
      active: false,
      lastChecked: new Date(0),
      features: DEFAULT_FEATURES,
    };
  })();

  getPreviousResultPromise
    .finally(() => {
      getPreviousResultPromise = null;
    })
    .catch(() => {});

  return getPreviousResultPromise;
};

const setPreviousResult = async (previousResult: TPreviousResult) => {
  if (globalThis.window !== undefined) return;

  try {
    const result = await cache.set(
      getCacheKeys().PREVIOUS_RESULT_CACHE_KEY,
      previousResult,
      CONFIG.CACHE.PREVIOUS_RESULT_TTL_MS
    );
    if (!result.ok) {
      logger.warn({ error: result.error }, "Failed to cache previous result");
    }
  } catch (error) {
    logger.error({ error }, "Failed to set previous result in cache");
  }
};

/**
 * Remembers that the license server refused a license that is still in grace, so a later unreachable
 * check reports the refusal rather than "unreachable". Without an active previous result there is no
 * grace to protect, and an unchanged refusal is not rewritten.
 *
 * Not serialized with other writers: a pod that read the previous result just before another pod stored
 * a newer active answer can write the refusal over it. That fails closed (Cloud refuses), and the next live
 * evaluation rewrites the previous result because `lastRefusal` is set, so it lasts at most one memory-cache
 * cycle. The license server would have to answer refused and active within that window.
 */
const recordLicenseRefusal = async (previousResult: TPreviousResult, refusal: TLicenseRefusalStatus) => {
  if (!previousResult.active || previousResult.lastRefusal === refusal) return;
  await setPreviousResult({ ...previousResult, lastRefusal: refusal });
};

/**
 * The refusal an HTTP 400 (`invalid_license`) or 403 (`instance_mismatch`) from the license server stands
 * for, recorded so a later unreachable check keeps it; `null` for any other error. Shared by the regular
 * check and the manual recheck so both read a rejection the same way.
 */
export const handleLicenseRejection = async (
  error: unknown
): Promise<Extract<TLicenseRefusalStatus, "invalid_license" | "instance_mismatch"> | null> => {
  if (!(error instanceof LicenseApiError) || (error.status !== 400 && error.status !== 403)) return null;
  const status = error.status === 400 ? "invalid_license" : "instance_mismatch";
  await recordLicenseRefusal(await getPreviousResult(), status);
  return status;
};

// Monitoring functions
const trackFallbackUsage = (level: FallbackLevel) => {
  logger.info(
    {
      fallbackLevel: level,
      timestamp: new Date().toISOString(),
    },
    `Using license fallback level: ${level}`
  );
};

// Validation functions
const validateFallback = (previousResult: TPreviousResult): boolean => {
  if (!previousResult.features) return false;
  if (previousResult.lastChecked.getTime() === new Date(0).getTime()) return false;
  return true;
};

// Fallback functions
let memoryCache: {
  data: TEnterpriseLicenseResult;
  timestamp: number;
} | null = null;

const MEMORY_CACHE_TTL_MS = 60 * 1000; // 1 minute memory cache to avoid stampedes and reduce load when Redis is slow

let getEnterpriseLicensePromise: Promise<TEnterpriseLicenseResult> | null = null;

// Grace deliberately covers every non-active answer, not just an unreachable server: a check that
// completes and reports "expired" takes this path too, so a lapsed key keeps its allowance for the
// rest of the window. That is the conservative side to err on — were the license server ever to
// answer "expired" wrongly, the window is what stops every self-hosted instance from downgrading at
// once. Narrowing it to failed checks only would be a deliberate policy change, not a cleanup.
const getFallbackLevel = (
  liveLicense: TEnterpriseLicenseDetails | null,
  previousResult: TPreviousResult,
  currentTime: Date
): FallbackLevel => {
  if (liveLicense?.status === "active") return "live";
  if (previousResult.active) {
    const elapsedTime = currentTime.getTime() - previousResult.lastChecked.getTime();
    return elapsedTime < CONFIG.CACHE.GRACE_PERIOD_MS ? "grace" : "default";
  }
  return "default";
};

const handleInitialFailure = async (currentTime: Date): Promise<TEnterpriseLicenseResult> => {
  const initialFailResult: TPreviousResult = {
    active: false,
    features: DEFAULT_FEATURES,
    lastChecked: currentTime,
  };
  await setPreviousResult(initialFailResult);
  return {
    active: false,
    features: DEFAULT_FEATURES,
    lastChecked: currentTime,
    isPendingDowngrade: false,
    fallbackLevel: "default" as const,
    status: "unreachable" as const,
  };
};

/**
 * Core license state evaluation logic.
 * Accepts pre-fetched license details and applies fallback / grace-period rules.
 * Sets the in-process memoryCache as a side effect so subsequent requests benefit.
 */
const computeLicenseState = async (
  liveLicenseDetails: TEnterpriseLicenseDetails | null
): Promise<TEnterpriseLicenseResult> => {
  validateConfig();

  if (!env.ENTERPRISE_LICENSE_KEY || env.ENTERPRISE_LICENSE_KEY.length === 0) {
    return {
      active: false,
      features: null,
      lastChecked: new Date(),
      isPendingDowngrade: false,
      fallbackLevel: "default" as const,
      status: "no-license" as const,
    };
  }

  const currentTime = new Date();
  const previousResult = await getPreviousResult();
  const fallbackLevel = getFallbackLevel(liveLicenseDetails, previousResult, currentTime);
  trackFallbackUsage(fallbackLevel);

  let currentLicenseState: TPreviousResult | undefined;

  switch (fallbackLevel) {
    case "live": {
      if (!liveLicenseDetails) throw new Error("Invalid state: live license expected");
      currentLicenseState = {
        active: liveLicenseDetails.status === "active",
        features: liveLicenseDetails.features,
        lastChecked: currentTime,
      };

      // Only update previous result if it's actually different or if it's old (1 hour)
      // This prevents hammering Redis on every request when the license is active.
      // An active answer also clears a recorded refusal, which `currentLicenseState` omits.
      if (
        !previousResult.active ||
        previousResult.active !== currentLicenseState.active ||
        previousResult.lastRefusal !== undefined ||
        currentTime.getTime() - previousResult.lastChecked.getTime() > 60 * 60 * 1000
      ) {
        await setPreviousResult(currentLicenseState);
      }

      const liveResult: TEnterpriseLicenseResult = {
        active: currentLicenseState.active,
        features: currentLicenseState.features,
        lastChecked: currentTime,
        isPendingDowngrade: false,
        fallbackLevel: "live" as const,
        status: liveLicenseDetails.status,
      };
      memoryCache = { data: liveResult, timestamp: Date.now() };
      return liveResult;
    }

    case "grace": {
      if (!validateFallback(previousResult)) {
        return await handleInitialFailure(currentTime);
      }
      logger.warn(
        {
          lastChecked: previousResult.lastChecked.toISOString(),
          gracePeriodEnds: new Date(
            previousResult.lastChecked.getTime() + CONFIG.CACHE.GRACE_PERIOD_MS
          ).toISOString(),
          timestamp: new Date().toISOString(),
        },
        "License server unreachable, using grace period. Will retry in ~10 minutes."
      );
      if (liveLicenseDetails?.status === "expired") {
        await recordLicenseRefusal(previousResult, "expired");
      }
      const graceResult: TEnterpriseLicenseResult = {
        active: previousResult.active,
        features: previousResult.features,
        lastChecked: previousResult.lastChecked,
        isPendingDowngrade: true,
        fallbackLevel: "grace" as const,
        status: liveLicenseDetails?.status ?? previousResult.lastRefusal ?? "unreachable",
      };
      memoryCache = { data: graceResult, timestamp: Date.now() };
      return graceResult;
    }

    case "default": {
      if (liveLicenseDetails?.status === "expired") {
        const expiredResult: TEnterpriseLicenseResult = {
          active: false,
          features: DEFAULT_FEATURES,
          lastChecked: currentTime,
          isPendingDowngrade: false,
          fallbackLevel: "default" as const,
          status: "expired" as const,
        };
        memoryCache = { data: expiredResult, timestamp: Date.now() };
        return expiredResult;
      }
      const failResult = await handleInitialFailure(currentTime);
      memoryCache = { data: failResult, timestamp: Date.now() };
      return failResult;
    }
  }

  const finalFailResult = await handleInitialFailure(currentTime);
  memoryCache = { data: finalFailResult, timestamp: Date.now() };
  return finalFailResult;
};

export const getEnterpriseLicense = reactCache(async (): Promise<TEnterpriseLicenseResult> => {
  if (env.NODE_ENV !== "test" && memoryCache && Date.now() - memoryCache.timestamp < MEMORY_CACHE_TTL_MS) {
    return memoryCache.data;
  }

  if (getEnterpriseLicensePromise) return getEnterpriseLicensePromise;

  getEnterpriseLicensePromise = (async () => {
    let liveLicenseDetails: TEnterpriseLicenseDetails | null = null;

    try {
      liveLicenseDetails = await fetchLicense();
    } catch (error) {
      const status = await handleLicenseRejection(error);
      if (status) {
        const invalidResult: TEnterpriseLicenseResult = {
          active: false,
          features: DEFAULT_FEATURES,
          lastChecked: new Date(),
          isPendingDowngrade: false,
          fallbackLevel: "default" as const,
          status,
        };
        memoryCache = { data: invalidResult, timestamp: Date.now() };
        return invalidResult;
      }
      // Other errors: liveLicenseDetails stays null (treated as unreachable)
    }

    return computeLicenseState(liveLicenseDetails);
  })();

  getEnterpriseLicensePromise
    .finally(() => {
      getEnterpriseLicensePromise = null;
    })
    .catch(() => {});

  return getEnterpriseLicensePromise;
});

export const getLicenseFeatures = async (): Promise<TEnterpriseLicenseFeatures | null> => {
  try {
    const licenseState = await getEnterpriseLicense();
    return licenseState.active ? licenseState.features : null;
  } catch (e) {
    logger.error(e, "Error getting license features");
    return null;
  }
};

/**
 * Clear license fetch cache (but preserve previous result cache for grace period)
 * Used by the recheck license action to force a fresh fetch without losing grace period
 */
export const clearLicenseCache = async (): Promise<void> => {
  memoryCache = null;
  const cacheKeys = getCacheKeys();
  // Only clear the main fetch cache, NOT the previous result cache
  // This preserves the grace period fallback if the server is unreachable
  const delResult = await cache.del([cacheKeys.FETCH_LICENSE_CACHE_KEY]);
  if (!delResult.ok) {
    logger.warn({ error: delResult.error }, "Failed to delete license cache");
  }
};

/**
 * Compute license state from pre-fetched license data, bypassing React cache
 * and the in-process memory cache. Used by the recheck action to guarantee
 * fresh evaluation after clearing caches and fetching new data.
 * Refreshes the in-process memory cache as a side effect so subsequent
 * requests benefit from the fresh result.
 */
export const computeFreshLicenseState = async (
  freshLicense: TEnterpriseLicenseDetails | null
): Promise<TEnterpriseLicenseResult> => {
  memoryCache = null;
  return computeLicenseState(freshLicense);
};

// All permission checking functions and their helpers have been moved to utils.ts
