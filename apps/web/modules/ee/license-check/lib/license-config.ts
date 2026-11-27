import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { COMMUNITY_WORKSPACE_LIMIT } from "@/lib/constants";
import { env } from "@/lib/env";
import { hashString } from "@/lib/hash-string";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { getDefaultLicenseServerUrl, resolveLicenseServerUrl } from "./license-server-url";

// Shared by the license client (license.ts) and its license-server fetch (license-fetch.ts): where the
// server is, how long answers are kept, the Redis keys they live under, and the errors the fetch raises.

const LICENSE_SERVER_URL = resolveLicenseServerUrl({
  nodeEnv: env.NODE_ENV,
  environment: env.ENVIRONMENT,
  overrideUrl: env.ENTERPRISE_LICENSE_SERVER_URL,
});
const IS_LICENSE_SERVER_OVERRIDDEN = LICENSE_SERVER_URL !== getDefaultLicenseServerUrl(env.ENVIRONMENT);

if (env.ENTERPRISE_LICENSE_SERVER_URL && !IS_LICENSE_SERVER_OVERRIDDEN) {
  logger.warn(
    "ENTERPRISE_LICENSE_SERVER_URL is ignored: it only applies to a development server with a loopback host"
  );
}

// Configuration
export const CONFIG = {
  CACHE: {
    FETCH_LICENSE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
    FAILED_FETCH_TTL_MS: 10 * 60 * 1000, // 10 minutes for failed/null results
    PREVIOUS_RESULT_TTL_MS: 4 * 24 * 60 * 60 * 1000, // 4 days
    GRACE_PERIOD_MS: 3 * 24 * 60 * 60 * 1000, // 3 days
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  },
  API: {
    ENDPOINT: `${LICENSE_SERVER_URL}/api/licenses/check`,
    TIMEOUT_MS: 5000,
  },
} as const;

// Error types
export class LicenseError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "LicenseError";
  }
}

export class LicenseApiError extends LicenseError {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message, "API_ERROR");
    this.name = "LicenseApiError";
  }
}

// Cache keys using enterprise-grade hierarchical patterns
const getCacheIdentifier = () => {
  if (globalThis.window !== undefined) {
    return "browser"; // Browser environment
  }
  if (!env.ENTERPRISE_LICENSE_KEY) {
    return "no-license"; // No license key provided
  }
  // A local licence server's answers (development only, see `resolveLicenseServerUrl`) get their own
  // slots, so turning the override off doesn't serve them as the real server's for up to four days.
  if (IS_LICENSE_SERVER_OVERRIDDEN) {
    return hashString(`${env.ENTERPRISE_LICENSE_KEY}@${LICENSE_SERVER_URL}`);
  }
  return hashString(env.ENTERPRISE_LICENSE_KEY); // Valid license key
};

export const getCacheKeys = () => {
  const identifier = getCacheIdentifier();
  return {
    FETCH_LICENSE_CACHE_KEY: createCacheKey.license.status(identifier),
    PREVIOUS_RESULT_CACHE_KEY: createCacheKey.license.previous_result(identifier),
    FETCH_LOCK_CACHE_KEY: createCacheKey.license.fetch_lock(identifier),
  };
};

// Default features
export const DEFAULT_FEATURES: TEnterpriseLicenseFeatures = {
  isMultiOrgEnabled: false,
  workspaces: COMMUNITY_WORKSPACE_LIMIT,
  twoFactorAuth: false,
  sso: false,
  whitelabel: false,
  removeBranding: false,
  contacts: false,
  aiSmartTools: false,
  saml: false,
  spamProtection: false,
  auditLogs: false,
  accessControl: false,
  quotas: false,
  feedbackDirectories: false,
  dashboards: false,
  workflows: false,
  dataRetention: false,
  creatives: false,
};
