import "server-only";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { E2E_TESTING } from "@/lib/constants";
import { env } from "@/lib/env";
import { getInstanceId } from "@/lib/instance";
import { type TProxiedRequestInit, proxyDispatcher } from "@/lib/proxy-dispatcher";
import type { TEnterpriseLicenseDetails } from "@/modules/ee/license-check/types/enterprise-license";
import { CONFIG, LicenseApiError, getCacheKeys } from "./license-config";

// Fetching the license from the license server: the HTTP check with its retries, and the Redis-cached,
// lock-guarded fetch every process shares. license.ts turns what this returns into the license state.

// Wrapper type for cached license fetch results.
// Storing { value: <result> } instead of <result> directly lets us distinguish
// "key not in cache" (get returns null) from "key exists with a null value"
// ({ value: null }) in a single cache.get call, eliminating the TOCTOU race
// that existed between separate get + exists calls.
type TCachedFetchResult = { value: TEnterpriseLicenseDetails | null };

// Validation schemas
const LicenseFeaturesSchema = z.object({
  isMultiOrgEnabled: z.boolean(),
  workspaces: z.number().nullable(),
  twoFactorAuth: z.boolean(),
  sso: z.boolean(),
  whitelabel: z.boolean(),
  removeBranding: z.boolean(),
  contacts: z.boolean(),
  aiSmartTools: z.boolean(),
  saml: z.boolean(),
  spamProtection: z.boolean(),
  auditLogs: z.boolean(),
  accessControl: z.boolean(),
  quotas: z.boolean(),
  feedbackDirectories: z.boolean().default(false),
  dashboards: z.boolean().default(false),
  workflows: z.boolean().default(false),
  dataRetention: z.boolean().default(false),
  // A licence server that predates the flag omits it, which keeps Creatives off (ENG-6602).
  creatives: z.boolean().default(false),
});

const LicenseDetailsSchema = z.object({
  status: z.enum(["active", "expired"]),
  features: LicenseFeaturesSchema,
});

const LICENSE_FETCH_LOCK_TTL_MS = 90 * 1000; // 90s lock so only one process fetches when cache is cold
const LICENSE_FETCH_POLL_MS = 2 * 1000; // Wait up to 2s for another process to populate cache
const LICENSE_FETCH_POLL_INTERVAL_MS = 400;

// Helper functions
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const trackApiError = (error: LicenseApiError) => {
  logger.error(
    {
      status: error.status,
      code: error.code,
      timestamp: new Date().toISOString(),
    },
    `License API error: ${error.message}`
  );
};

const validateLicenseDetails = (data: unknown): TEnterpriseLicenseDetails => {
  return LicenseDetailsSchema.parse(data);
};

/**
 * Try to read cached license from Redis. Returns undefined on miss or error.
 */
const getCachedLicense = async (): Promise<TEnterpriseLicenseDetails | null | undefined> => {
  const keys = getCacheKeys();
  const result = await cache.get<TCachedFetchResult>(keys.FETCH_LICENSE_CACHE_KEY);
  if (!result.ok) return undefined;
  if (result.data !== null && result.data !== undefined && "value" in result.data) {
    return result.data.value;
  }
  return undefined;
};

// API functions
let fetchLicensePromise: Promise<TEnterpriseLicenseDetails | null> | null = null;

const fetchLicenseFromServerInternal = async (retryCount = 0): Promise<TEnterpriseLicenseDetails | null> => {
  if (!env.ENTERPRISE_LICENSE_KEY) return null;

  // Skip license checks during build time
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    // first millisecond of next year => current year is fully included
    const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

    const startTime = Date.now();
    const [instanceId, responseCount] = await Promise.all([
      // Skip instance ID during E2E tests to avoid license key conflicts
      // as the instance ID changes with each test run
      E2E_TESTING ? null : getInstanceId(),
      prisma.response.count({
        where: {
          createdAt: {
            gte: startOfYear,
            lt: startOfNextYear,
          },
        },
      }),
    ]);
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      logger.warn({ duration, responseCount }, "Slow license check prerequisite data fetching (DB count)");
    }

    // No organization exists, cannot perform license check
    // (skip this check during E2E tests as we intentionally use null)
    if (!E2E_TESTING && !instanceId) return null;

    const payload: Record<string, unknown> = {
      licenseKey: env.ENTERPRISE_LICENSE_KEY,
      usage: { responseCount },
    };

    if (instanceId) {
      payload.instanceId = instanceId;
    }

    const res = await fetch(CONFIG.API.ENDPOINT, {
      body: JSON.stringify(payload),
      dispatcher: proxyDispatcher,
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(CONFIG.API.TIMEOUT_MS),
    } as TProxiedRequestInit);

    if (res.ok) {
      const responseJson = (await res.json()) as { data: unknown };
      const licenseDetails = validateLicenseDetails(responseJson.data);

      logger.debug(
        {
          status: licenseDetails.status,
          instanceId: instanceId ?? "not-set",
          responseCount,
          timestamp: new Date().toISOString(),
        },
        "License check API response received"
      );

      return licenseDetails;
    }

    const error = new LicenseApiError(`License check API responded with status: ${res.status}`, res.status);
    trackApiError(error);

    // Retry on specific status codes
    if (retryCount < CONFIG.CACHE.MAX_RETRIES && [429, 502, 503, 504].includes(res.status)) {
      await sleep(CONFIG.CACHE.RETRY_DELAY_MS * Math.pow(2, retryCount));
      return fetchLicenseFromServerInternal(retryCount + 1);
    }

    // 400 = invalid license key, 403 = license bound to another instance.
    // Propagate both so callers can distinguish them from unreachable.
    if (res.status === 400 || res.status === 403) {
      throw error;
    }

    return null;
  } catch (error) {
    if (error instanceof LicenseApiError) {
      throw error;
    }
    logger.error(error, "Error while fetching license from server");
    logger.warn(
      {
        timestamp: new Date().toISOString(),
      },
      "License server fetch returned null - server may be unreachable"
    );
    return null;
  }
};

export const fetchLicense = async (): Promise<TEnterpriseLicenseDetails | null> => {
  if (!env.ENTERPRISE_LICENSE_KEY) return null;

  // Skip license checks during build time - check before cache access
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  if (fetchLicensePromise) {
    return fetchLicensePromise;
  }

  fetchLicensePromise = (async () => {
    const keys = getCacheKeys();
    const cached = await getCachedLicense();
    if (cached !== undefined) return cached;

    const lockResult = await cache.tryLock(keys.FETCH_LOCK_CACHE_KEY, "1", LICENSE_FETCH_LOCK_TTL_MS);
    const acquired = lockResult.ok && lockResult.data === true;
    const redisError = !lockResult.ok;

    if (acquired) {
      try {
        const fresh = await fetchLicenseFromServerInternal();
        const ttl = fresh ? CONFIG.CACHE.FETCH_LICENSE_TTL_MS : CONFIG.CACHE.FAILED_FETCH_TTL_MS;

        if (!fresh) {
          logger.warn(
            {
              ttlMinutes: Math.floor(ttl / 60000),
              timestamp: new Date().toISOString(),
            },
            "License fetch failed, caching null result with short TTL for faster retry"
          );
        }

        await cache.set(keys.FETCH_LICENSE_CACHE_KEY, { value: fresh }, ttl);
        return fresh;
      } finally {
        // Lock expires automatically; no need to release
      }
    }

    // If Redis itself is down, skip the polling loop (it would just fail repeatedly)
    // and go directly to fetching from the server.
    if (redisError) {
      logger.warn("Redis unavailable during license fetch lock; skipping poll and fetching directly");
      return await fetchLicenseFromServerInternal();
    }

    // Another process holds the lock — poll until the cache is populated or timeout
    const deadline = Date.now() + LICENSE_FETCH_POLL_MS;
    while (Date.now() < deadline) {
      await sleep(LICENSE_FETCH_POLL_INTERVAL_MS);
      const value = await getCachedLicense();
      if (value !== undefined) return value;
    }

    logger.warn(
      { pollMs: LICENSE_FETCH_POLL_MS },
      "License cache not populated by holder within poll window; fetching in this process"
    );
    const fallback = await fetchLicenseFromServerInternal();
    const fallbackTtl = fallback ? CONFIG.CACHE.FETCH_LICENSE_TTL_MS : CONFIG.CACHE.FAILED_FETCH_TTL_MS;
    await cache.set(keys.FETCH_LICENSE_CACHE_KEY, { value: fallback }, fallbackTtl);
    return fallback;
  })();

  fetchLicensePromise
    .finally(() => {
      fetchLicensePromise = null;
    })
    .catch(() => {});

  return fetchLicensePromise;
};

/**
 * Fetch license directly from server without using cache.
 * Used by the recheck license action for a fresh check.
 * Concurrent callers share a single in-flight request to avoid
 * hammering the license server (e.g. multiple managers rechecking).
 */
let fetchLicenseFreshPromise: Promise<TEnterpriseLicenseDetails | null> | null = null;

export const fetchLicenseFresh = async (): Promise<TEnterpriseLicenseDetails | null> => {
  if (fetchLicenseFreshPromise) return fetchLicenseFreshPromise;

  fetchLicenseFreshPromise = fetchLicenseFromServerInternal();

  fetchLicenseFreshPromise
    .finally(() => {
      fetchLicenseFreshPromise = null;
    })
    .catch(() => {});

  return fetchLicenseFreshPromise;
};
