type TLicenseServerEnvironment = "production" | "staging";

// `URL` lowercases the host and keeps the brackets around an IPv6 address.
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The origin of an http(s) URL whose host is loopback, or `null` for anything else. */
const getLoopbackOrigin = (value: string): string | null => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const isLoopback = LOOPBACK_HOSTNAMES.has(url.hostname) || url.hostname.endsWith(".localhost");
  return isLoopback ? url.origin : null;
};

export const getDefaultLicenseServerUrl = (environment: TLicenseServerEnvironment): string =>
  environment === "staging" ? "https://staging.ee.formbricks.com" : "https://ee.formbricks.com";

/**
 * The licence server the instance checks its Enterprise licence against: ee.formbricks.com (or its
 * staging twin), unless a development instance points `ENTERPRISE_LICENSE_SERVER_URL` at one of its own.
 *
 * The override exists so local QA can test licence-gated features against a licence server running on
 * the same machine. It is honoured only when both hold, and the real server is used otherwise:
 *
 * - `nodeEnv` is `"development"` (`next dev`). A production build runs with `"production"`, so a shipped
 *   image can never be pointed at a self-run licence server; if it could, anyone could answer their own
 *   licence check and unlock every Enterprise feature. Whoever runs `next dev` already has the source and
 *   could edit this check, so allowing the override there gives nothing away.
 * - the URL's host is loopback (`localhost`, `127.0.0.1`, `::1` or `*.localhost`), so even a development
 *   instance never sends its licence key to another machine.
 *
 * Only the override's origin is used; the caller appends the check path.
 */
export const resolveLicenseServerUrl = ({
  nodeEnv,
  environment,
  overrideUrl,
}: {
  nodeEnv: string | undefined;
  environment: TLicenseServerEnvironment;
  overrideUrl: string | undefined;
}): string => {
  const defaultUrl = getDefaultLicenseServerUrl(environment);
  if (!overrideUrl || nodeEnv !== "development") return defaultUrl;
  return getLoopbackOrigin(overrideUrl) ?? defaultUrl;
};
