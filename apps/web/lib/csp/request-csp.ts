import { env } from "@/lib/env";
import { buildContentSecurityPolicy, createCspNonce, getCspRoute } from "./content-security-policy";
import { getCspHosts } from "./hosts";

const isDevelopment = env.NODE_ENV === "development";

// Read once: these come from the environment the server started with.
const hosts = getCspHosts({
  webappUrl: env.WEBAPP_URL?.trim() || "http://localhost:3000",
  publicUrl: env.PUBLIC_URL?.trim(),
  formbricksAppUrl: env.FORMBRICKS_WORKSPACE_ID
    ? env.FORMBRICKS_APP_URL || "https://app.formbricks.com"
    : undefined,
  s3EndpointUrl: env.S3_ENDPOINT_URL,
  s3BucketName: env.S3_BUCKET_NAME,
  s3Region: env.S3_REGION,
  s3ForcePathStyle: env.S3_FORCE_PATH_STYLE === "1",
  sentryDsn: env.SENTRY_DSN,
  allowLoopback: env.NODE_ENV !== "production" || env.E2E_TESTING === "1",
});

/**
 * Uploaded files get their own, stricter policy from next.config.mjs (ENG-7108); a second policy from
 * here would only be enforced alongside it, so they are left alone.
 */
const STORAGE_PATH = /^\/storage(?:\/|$)/i;

export interface TRequestCsp {
  nonce: string;
  /** Undefined for routes whose policy is set elsewhere. */
  policy?: string;
}

/** A fresh nonce and the policy for the route being requested. */
export const getRequestCsp = (pathname: string): TRequestCsp => {
  const nonce = createCspNonce();
  if (STORAGE_PATH.test(pathname)) return { nonce };
  return {
    nonce,
    policy: buildContentSecurityPolicy({ nonce, route: getCspRoute(pathname), hosts, isDevelopment }),
  };
};
