import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { hashString } from "@/lib/hash-string";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { checkRateLimit } from "./rate-limit";
import { rateLimitConfigs } from "./rate-limit-configs";
import { type TRateLimitConfig, type TRateLimitResponse } from "./types/rate-limit";

/**
 * Get client identifier for rate limiting with IP hashing
 * Used when the user is not authenticated or the api is called from the client
 *
 * @returns {Promise<string>} Hashed IP address for rate limiting
 * @throws {Error} When IP hashing fails due to invalid IP format or hashing algorithm issues
 */
export const getClientIdentifier = async (): Promise<string> => {
  const ip = await getClientIpFromHeaders();

  try {
    return hashString(ip);
  } catch (error) {
    const errorMessage = "Failed to hash IP";
    logger.error({ error }, errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * Generic rate limit application function
 *
 * @param config - Rate limit configuration
 * @param identifier - Unique identifier for rate limiting (IP hash, user ID, API key, etc.)
 * @throws {Error} When rate limit is exceeded or rate limiting system fails
 */
export const applyRateLimit = async (
  config: TRateLimitConfig,
  identifier: string
): Promise<TRateLimitResponse> => {
  const result = await checkRateLimit(config, identifier);

  if (!result.ok || !result.data.allowed) {
    throw new TooManyRequestsError(
      "Maximum number of requests reached. Please try again later.",
      result.ok ? result.data.retryAfter : undefined
    );
  }

  return result.data;
};

/**
 * Apply IP-based rate limiting for unauthenticated requests
 * Generic function for IP-based rate limiting in authentication flows and public pages
 *
 * @param config - Rate limit configuration to apply
 * @throws {Error} When rate limit is exceeded or IP hashing fails
 */
export const applyIPRateLimit = async (config: TRateLimitConfig): Promise<TRateLimitResponse> => {
  const identifier = await getClientIdentifier();
  return await applyRateLimit(config, identifier);
};

/**
 * Apply public client API rate limiting scoped by environment.
 *
 * The compound environment/IP check keeps the existing per-client behavior without cross-environment
 * interference, while the environment-only check bounds distributed-IP abuse against one environment.
 *
 * @param environmentId - Public client API environment ID from the route params
 * @param customRateLimitConfig - Optional route-specific limit for the environment/IP check
 * @throws {Error} When rate limit is exceeded or IP hashing fails
 */
export const applyClientRateLimit = async (
  environmentId: string,
  customRateLimitConfig?: TRateLimitConfig
): Promise<TRateLimitResponse> => {
  const identifier = await getClientIdentifier();
  const compoundIdentifier = `${environmentId}:${identifier}`;

  await applyRateLimit(customRateLimitConfig ?? rateLimitConfigs.api.client, compoundIdentifier);
  return await applyRateLimit(rateLimitConfigs.api.clientEnvironment, environmentId);
};
