import { hashString } from "@/lib/hash-string";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { logger } from "@formbricks/logger";
import { checkRateLimit } from "./rate-limit";
import { type TRateLimitConfig } from "./types/rate-limit";

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
    const hashedIp = hashString(ip);
    return hashedIp;
  } catch (error) {
    const errorMessage = "Failed to hash IP";
    logger.error(errorMessage, { error });
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
export const applyRateLimit = async (config: TRateLimitConfig, identifier: string): Promise<void> => {
  const result = await checkRateLimit(config, identifier);

  if (!result.ok || !result.data.allowed) {
    throw new Error("Maximum number of requests reached. Please try again later.");
  }
};

/**
 * Apply IP-based rate limiting for unauthenticated requests
 * Generic function for IP-based rate limiting in authentication flows and public pages
 *
 * @param config - Rate limit configuration to apply
 * @throws {Error} When rate limit is exceeded or IP hashing fails
 */
export const applyIPRateLimit = async (config: TRateLimitConfig): Promise<void> => {
  const identifier = await getClientIdentifier();
  await applyRateLimit(config, identifier);
};
