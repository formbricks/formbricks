import { env } from "@/lib/env";
import { NextRequest } from "next/server";

/**
 * Get the public domain from PUBLIC_URL environment variable
 */
export const getPublicDomainHost = (): string | null => {
  const PUBLIC_URL = env.PUBLIC_URL;
  if (!PUBLIC_URL) return null;

  console.log("PUBLIC_URL", PUBLIC_URL);
  return new URL(PUBLIC_URL).host;
};

/**
 * Check if PUBLIC_URL is configured (has a valid public domain)
 */
export const isPublicDomainConfigured = (): boolean => {
  return getPublicDomainHost() !== null;
};

/**
 * Check if the current request is coming from the public domain
 */
export const isRequestFromPublicDomain = (request: NextRequest): boolean => {
  const host = request.headers.get("host");
  const publicDomainHost = getPublicDomainHost();

  if (!publicDomainHost) return false;

  return host === publicDomainHost;
};
