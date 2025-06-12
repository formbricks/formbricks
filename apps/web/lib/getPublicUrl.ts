import "server-only";
import { env } from "./env";

const WEBAPP_URL =
  env.WEBAPP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : false) || "http://localhost:3000";

/**
 * Returns the public domain URL
 * Uses PUBLIC_URL if set, otherwise falls back to WEBAPP_URL
 */
export const getPublicDomain = (): string => {
  return env.PUBLIC_URL || WEBAPP_URL;
};
