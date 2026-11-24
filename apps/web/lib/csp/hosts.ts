import type { TCspHosts } from "./content-security-policy";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

const toOrigin = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : undefined;
  } catch {
    return undefined;
  }
};

const isLoopback = (origin: string): boolean => LOOPBACK_HOSTS.has(new URL(origin).hostname);

/** Both spellings of a loopback origin, since the browser treats `localhost` and `127.0.0.1` apart. */
const loopbackVariants = (origin: string): string[] => {
  const url = new URL(origin);
  const other = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
  const port = url.port ? `:${url.port}` : "";
  return [origin, `${url.protocol}//${other}${port}`];
};

export interface TCspHostConfig {
  webappUrl?: string;
  publicUrl?: string;
  /** Where the build serves its scripts, styles and fonts from (ASSET_PREFIX_URL), when not this origin. */
  assetPrefixUrl?: string;
  /** The Formbricks instance whose SDK runs in the app (FORMBRICKS_APP_URL), when it is configured. */
  formbricksAppUrl?: string;
  s3EndpointUrl?: string;
  s3BucketName?: string;
  s3Region?: string;
  /** AWS_REGION: where the storage client's AWS SDK resolves the region without S3_REGION. */
  awsSdkRegion?: string;
  s3ForcePathStyle: boolean;
  sentryDsn?: string;
  /** Development and E2E builds: allow loopback origins (local S3, a second dev server). */
  allowLoopback: boolean;
}

/**
 * Where the browser POSTs a presigned upload: the bucket's host on a custom endpoint (virtual-hosted
 * unless path style is forced), or on AWS when no endpoint is set.
 */
const getStorageOrigins = ({
  s3EndpointUrl,
  s3BucketName,
  s3Region,
  awsSdkRegion,
  s3ForcePathStyle,
}: TCspHostConfig): string[] => {
  const endpoint = toOrigin(s3EndpointUrl);
  if (endpoint) {
    if (s3ForcePathStyle || !s3BucketName) return [endpoint];
    const url = new URL(endpoint);
    return [endpoint, `${url.protocol}//${s3BucketName}.${url.host}`];
  }
  if (!s3BucketName) return [];
  const region = s3Region || awsSdkRegion;
  const regional = region ? `s3.${region}` : "s3";
  return [`https://${s3BucketName}.${regional}.amazonaws.com`, `https://${regional}.amazonaws.com`];
};

/**
 * The configured origins the CSP must allow. Loopback origins (http://localhost…) are kept out of
 * production builds that do not run E2E tests, the same rule the previous static CSP applied.
 */
export const getCspHosts = (config: TCspHostConfig): TCspHosts => {
  const withoutDisallowedLoopback = (origins: (string | undefined)[]): string[] =>
    origins.filter(
      (origin): origin is string => Boolean(origin) && (config.allowLoopback || !isLoopback(origin!))
    );

  const appOrigins = withoutDisallowedLoopback([
    toOrigin(config.webappUrl),
    toOrigin(config.publicUrl),
    toOrigin(config.assetPrefixUrl),
    toOrigin(config.formbricksAppUrl),
  ]);
  const storageOrigins = withoutDisallowedLoopback(getStorageOrigins(config));
  const sentryOrigins = withoutDisallowedLoopback([toOrigin(config.sentryDsn)]);

  // Any local port over plain HTTP (local S3, a second dev server), plus both spellings of configured
  // loopback origins, which may be HTTPS.
  const loopbackOrigins = config.allowLoopback
    ? [
        ...new Set([
          ...[...LOOPBACK_HOSTS].map((host) => `http://${host}:*`),
          ...[...appOrigins, ...storageOrigins].filter(isLoopback).flatMap(loopbackVariants),
        ]),
      ]
    : [];

  return { appOrigins, storageOrigins, sentryOrigins, loopbackOrigins };
};
