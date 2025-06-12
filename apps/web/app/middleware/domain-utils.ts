import { env } from "@/lib/env";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";

/**
 * Get the public domain from PUBLIC_URL environment variable
 */
export const getPublicDomain = (): string | null => {
  try {
    const PUBLIC_URL = env.PUBLIC_URL;
    if (!PUBLIC_URL || PUBLIC_URL.trim() === "") return null;
    return new URL(PUBLIC_URL).host;
  } catch (error) {
    logger.error(error, "Error getting public domain");
    return null;
  }
};

/**
 * Check if PUBLIC_URL is configured (has a valid public domain)
 */
export const hasPublicDomainConfigured = (): boolean => {
  return getPublicDomain() !== null;
};

/**
 * Check if the current request is coming from the public domain
 */
export const isRequestFromPublicDomain = (request: NextRequest): boolean => {
  const host = request.headers.get("host");
  const publicDomain = getPublicDomain();

  if (!publicDomain) return false;

  return host === publicDomain;
};
