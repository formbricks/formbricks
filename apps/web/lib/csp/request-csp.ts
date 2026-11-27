import {
  E2E_TESTING,
  FORMBRICKS_APP_URL,
  IS_DEVELOPMENT,
  IS_FORMBRICKS_SURVEYS_CONFIGURED,
  IS_PRODUCTION,
  S3_BUCKET_NAME,
  S3_ENDPOINT_URL,
  S3_FORCE_PATH_STYLE,
  S3_REGION,
  SENTRY_DSN,
  WEBAPP_URL,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { buildContentSecurityPolicy, createCspNonce, getCspRoute } from "./content-security-policy";
import { getCspHosts } from "./hosts";

// Read once: these come from the environment the server started with.
const hosts = getCspHosts({
  webappUrl: WEBAPP_URL,
  publicUrl: env.PUBLIC_URL?.trim(),
  assetPrefixUrl: env.ASSET_PREFIX_URL,
  formbricksAppUrl: IS_FORMBRICKS_SURVEYS_CONFIGURED ? FORMBRICKS_APP_URL : undefined,
  s3EndpointUrl: S3_ENDPOINT_URL,
  s3BucketName: S3_BUCKET_NAME,
  s3Region: S3_REGION,
  awsSdkRegion: env.AWS_REGION,
  s3ForcePathStyle: S3_FORCE_PATH_STYLE,
  sentryDsn: SENTRY_DSN,
  allowLoopback: !IS_PRODUCTION || E2E_TESTING,
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
    policy: buildContentSecurityPolicy({
      nonce,
      route: getCspRoute(pathname),
      hosts,
      isDevelopment: IS_DEVELOPMENT,
    }),
  };
};
