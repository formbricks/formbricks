import "server-only";
import { env } from "./env";

const configuredWebappUrl = env.WEBAPP_URL?.trim() ?? "";
const WEBAPP_URL =
  configuredWebappUrl !== ""
    ? configuredWebappUrl
    : env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : "http://localhost:3000";

/**
 * Returns the public domain URL
 * Uses PUBLIC_URL if set, otherwise falls back to WEBAPP_URL
 */
export const getPublicDomain = (): string => {
  return env.PUBLIC_URL && env.PUBLIC_URL.trim() !== "" ? env.PUBLIC_URL : WEBAPP_URL;
};
