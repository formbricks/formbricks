import { hashString } from "@/lib/hashString";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { logger } from "@formbricks/logger";
import { checkRateLimit } from "./rate-limit";
import { type TRateLimitConfig } from "./types/rate-limit";

/**
 * Get client identifier for rate limiting with IP hashing
 * Used when the user is not authenticated or the api is called from the client
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
 */
export const applyRateLimit = async (config: TRateLimitConfig, identifier: string): Promise<void> => {
  const result = await checkRateLimit(config, identifier);

  if (!result.ok || !result.data.allowed) {
    throw new Error("Rate limit exceeded");
  }
};
