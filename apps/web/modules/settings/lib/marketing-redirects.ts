import {
  accountSettingsPath,
  getOrganizationBillingPath,
  organizationSettingsPath,
} from "@/modules/settings/lib/routes";

// Stable, ID-free app links for marketing pages, campaigns and social posts (app.formbricks.com/billing,
// app.formbricks.com/settings/...). The route handlers in app/(redirects)/ resolve the user's current
// organization and hand everything else to the pure helpers below.

// First /settings segments that are account (user-level) settings rather than organization settings.
const ACCOUNT_SETTINGS_SLUGS = new Set(["profile", "notifications", "authorized-apps"]);

// Bare /settings goes straight to the general page instead of the /organizations/<id>/settings index:
// that page redirects to general on its own but drops the query string, which would lose UTM params.
const DEFAULT_ORGANIZATION_SETTINGS_SLUG = "general";

/**
 * Drops empty, "." and ".." segments and percent-encodes the rest, so a segment taken from the URL can
 * never add a path level, climb out of the settings base, or turn the Location into a
 * protocol-relative (off-site) URL. Every destination also starts with a fixed app path.
 */
const toSafeSegments = (segments: readonly string[] | undefined): string[] =>
  (segments ?? [])
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .map((segment) => encodeURIComponent(segment));

export const getSettingsRedirectPath = (
  organizationId: string,
  segments: readonly string[] | undefined,
  isFormbricksCloud: boolean
): string => {
  const safeSegments = toSafeSegments(segments);
  if (safeSegments.length === 0) {
    return organizationSettingsPath(organizationId, DEFAULT_ORGANIZATION_SETTINGS_SLUG);
  }

  // Self-hosted has no billing page; /settings/billing lands where /billing does (enterprise).
  if (safeSegments[0] === "billing" && !isFormbricksCloud) {
    return getOrganizationBillingPath(organizationId, isFormbricksCloud);
  }

  const slug = safeSegments.join("/");
  return ACCOUNT_SETTINGS_SLUGS.has(safeSegments[0])
    ? accountSettingsPath(slug)
    : organizationSettingsPath(organizationId, slug);
};

/**
 * Appends the incoming query string (e.g. UTM params) to an app path. `search` is the `search`
 * property of a `URL`.
 */
export const appendSearch = (path: string, search: string): string =>
  search && search !== "?" ? `${path}${search.startsWith("?") ? search : `?${search}`}` : path;

/** Same login URL the proxy's `handleAuth` builds, so the user lands back on this link after sign-in. */
export const getLoginRedirectUrl = (webAppUrl: string, pathname: string, search: string): string =>
  `${webAppUrl}/auth/login?callbackUrl=${encodeURIComponent(webAppUrl + pathname + search)}`;

interface TMarketingRedirectInput {
  isAuthenticated: boolean;
  organizationId: string | undefined;
  url: URL;
  webAppUrl: string;
  buildPath: (organizationId: string) => string;
}

/**
 * Where a marketing link sends the user: logged out to login (returning here afterwards), logged in
 * without an organization to "/" (which handles setup/onboarding), otherwise to `buildPath` for their
 * current organization with the incoming query string kept.
 */
export const getMarketingRedirectTarget = ({
  isAuthenticated,
  organizationId,
  url,
  webAppUrl,
  buildPath,
}: TMarketingRedirectInput): string => {
  if (!isAuthenticated) return getLoginRedirectUrl(webAppUrl, url.pathname, url.search);
  if (!organizationId) return "/";
  return appendSearch(buildPath(organizationId), url.search);
};
