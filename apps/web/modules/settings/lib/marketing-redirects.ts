import {
  accountSettingsPath,
  getOrganizationBillingPath,
  organizationSettingsPath,
  workspaceSettingsPath,
} from "@/modules/settings/lib/routes";

// Stable, ID-free app links for marketing pages, campaigns and social posts (app.formbricks.com/billing,
// app.formbricks.com/settings/..., app.formbricks.com/contacts, ...). The route handlers in
// app/(redirects)/ resolve the user's current organization (and workspace) and hand everything else to
// the pure helpers below.

// Pages /settings/<slug> can open, per settings area. Only these strings ever reach a destination: an
// unknown slug (a typo, a page that was renamed) opens organization General instead of a 404, and no
// URL segment is ever echoed into the path. "general" and "teams" exist in both the organization and the
// workspace area; the organization one wins, as /settings is organization settings first.
const ORGANIZATION_SETTINGS_SLUGS = new Set([
  "general",
  "teams",
  "api-keys",
  "billing",
  "usage",
  "domain",
  "enterprise",
  "feedback-directories",
]);
const ACCOUNT_SETTINGS_SLUGS = new Set(["profile", "notifications", "authorized-apps"]);
const WORKSPACE_SETTINGS_SLUGS = new Set([
  "look",
  "languages",
  "tags",
  "embedded-data",
  "app-connection",
  "user-actions",
  "integrations",
]);
const INTEGRATION_SLUGS = new Set(["slack", "notion", "airtable", "google-sheets", "webhooks"]);

// Bare /settings goes straight to the general page instead of the /organizations/<id>/settings index:
// that page redirects to general on its own but drops the query string, which would lose UTM params.
const DEFAULT_ORGANIZATION_SETTINGS_SLUG = "general";

// URL segments arrive decoded and as typed; marketing copy is not always lower-case.
const normalizeSegment = (segment: string | undefined): string => segment?.trim().toLowerCase() ?? "";

export const getSettingsDestination = (
  segments: readonly string[] | undefined,
  isFormbricksCloud: boolean
): TMarketingDestination => {
  const [first, second] = (segments ?? []).map(normalizeSegment);

  // /settings/billing lands where /billing does (enterprise on self-hosted, which has no billing page).
  if (first === "billing" || first === "enterprise") {
    return {
      scope: "organization",
      buildPath: (organizationId) => getOrganizationBillingPath(organizationId, isFormbricksCloud),
    };
  }
  if (ACCOUNT_SETTINGS_SLUGS.has(first)) {
    return { scope: "organization", buildPath: () => accountSettingsPath(first) };
  }
  if (WORKSPACE_SETTINGS_SLUGS.has(first) && !ORGANIZATION_SETTINGS_SLUGS.has(first)) {
    const page = first === "integrations" && INTEGRATION_SLUGS.has(second) ? `integrations/${second}` : first;
    return { scope: "workspace", buildPath: (workspaceId) => workspaceSettingsPath(workspaceId, page) };
  }
  const slug = ORGANIZATION_SETTINGS_SLUGS.has(first) ? first : DEFAULT_ORGANIZATION_SETTINGS_SLUG;
  return {
    scope: "organization",
    buildPath: (organizationId) => organizationSettingsPath(organizationId, slug),
  };
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

/**
 * Where a link points once the user's context is known. Organization-scoped destinations only need
 * the current organization; workspace-scoped ones open inside the current workspace.
 */
export type TMarketingDestination =
  | { scope: "organization"; buildPath: (organizationId: string) => string }
  | { scope: "workspace"; buildPath: (workspaceId: string) => string };

// Where a logged-in user with an organization but no accessible workspace goes for a workspace link: the
// organization redirect in app/(redirects)/organizations/[organizationId], which already sends billing
// members to billing and an organization without workspaces to its landing page.
const getOrganizationHomePath = (organizationId: string): string => `/organizations/${organizationId}`;

interface TMarketingRedirectInput {
  isAuthenticated: boolean;
  organizationId: string | undefined;
  workspaceId?: string;
  url: URL;
  webAppUrl: string;
  destination: TMarketingDestination;
}

/**
 * Where a marketing link sends the user: logged out to login (returning here afterwards), logged in
 * without an organization to "/" (which handles setup/onboarding), a workspace link without an
 * accessible workspace to the organization home (see `getOrganizationHomePath`), otherwise to the destination. The incoming
 * query string is kept on every in-app target.
 */
export const getMarketingRedirectTarget = ({
  isAuthenticated,
  organizationId,
  workspaceId,
  url,
  webAppUrl,
  destination,
}: TMarketingRedirectInput): string => {
  if (!isAuthenticated) return getLoginRedirectUrl(webAppUrl, url.pathname, url.search);
  if (!organizationId) return "/";
  if (destination.scope === "organization") {
    return appendSearch(destination.buildPath(organizationId), url.search);
  }
  if (!workspaceId) return appendSearch(getOrganizationHomePath(organizationId), url.search);
  return appendSearch(destination.buildPath(workspaceId), url.search);
};

type TSectionKind =
  | "workspace"
  | "workspace-settings"
  | "organization-settings"
  | "organization-billing"
  | "account-settings";

interface TMarketingSection {
  kind: TSectionKind;
  // Page relative to the kind's base: /workspaces/<id>/, workspace settings, organization settings or
  // account settings.
  page: string;
  // Allow-listed first sub-segments and the page each opens. Anything else opens `page`.
  subPages?: Readonly<Record<string, string>>;
}

/**
 * One row per ID-free feature link (`/<section>[/<sub-page>]`). Only these strings ever reach a
 * destination path: URL segments are matched against the allow-lists and never echoed, so an unknown,
 * extra or crafted segment just opens the section's main page.
 */
export const MARKETING_SECTIONS = {
  "embedded-data": { kind: "workspace-settings", page: "embedded-data" },
  // Same target as /billing: the enterprise page is self-hosted only (it 404s on Cloud, where enterprise
  // plans are bought on the billing page).
  "enterprise-license": { kind: "organization-billing", page: "enterprise" },
  // The MCP server authenticates through OAuth; connected MCP clients are managed as authorized apps.
  mcp: { kind: "account-settings", page: "authorized-apps" },
  contacts: {
    kind: "workspace",
    page: "contacts",
    subPages: { segments: "segments", attributes: "attributes" },
  },
  // The branding card ("Formbricks branding") lives on the Look & Feel page.
  "branding-removal": { kind: "workspace-settings", page: "look" },
  "feedback-unification": {
    kind: "workspace",
    // Not "unify": that index page redirects to feedback-records on its own and drops the query string.
    page: "unify/feedback-records",
    subPages: {
      sources: "unify/sources",
      "feedback-records": "unify/feedback-records",
      taxonomy: "unify/taxonomy",
    },
  },
  analysis: {
    kind: "workspace",
    page: "dashboards",
    subPages: { dashboards: "dashboards", charts: "charts" },
  },
  workflows: { kind: "workspace", page: "workflows", subPages: { runs: "workflows/runs" } },
  surveys: { kind: "workspace", page: "surveys" },
  integrations: {
    kind: "workspace-settings",
    page: "integrations",
    subPages: {
      slack: "integrations/slack",
      notion: "integrations/notion",
      airtable: "integrations/airtable",
      "google-sheets": "integrations/google-sheets",
      webhooks: "integrations/webhooks",
    },
  },
} as const satisfies Record<string, TMarketingSection>;

export type TMarketingSectionSlug = keyof typeof MARKETING_SECTIONS;

const toDestination = (
  kind: TSectionKind,
  page: string,
  isFormbricksCloud: boolean
): TMarketingDestination => {
  switch (kind) {
    case "workspace":
      return { scope: "workspace", buildPath: (workspaceId) => `/workspaces/${workspaceId}/${page}` };
    case "workspace-settings":
      return { scope: "workspace", buildPath: (workspaceId) => workspaceSettingsPath(workspaceId, page) };
    case "organization-settings":
      return {
        scope: "organization",
        buildPath: (organizationId) => organizationSettingsPath(organizationId, page),
      };
    case "organization-billing":
      return {
        scope: "organization",
        buildPath: (organizationId) => getOrganizationBillingPath(organizationId, isFormbricksCloud),
      };
    case "account-settings":
      // Account settings carry no ID, but still need an organization for the settings shell.
      return { scope: "organization", buildPath: () => accountSettingsPath(page) };
  }
};

/** Resolves `/<section>/<segments...>` to its destination, falling back to the section's main page. */
export const getSectionDestination = (
  slug: TMarketingSectionSlug,
  segments: readonly string[] | undefined,
  isFormbricksCloud: boolean
): TMarketingDestination => {
  const section: TMarketingSection = MARKETING_SECTIONS[slug];
  const subPages = new Map(Object.entries(section.subPages ?? {}));
  const subPage = segments?.length === 1 ? subPages.get(normalizeSegment(segments[0])) : undefined;
  return toDestination(section.kind, subPage ?? section.page, isFormbricksCloud);
};
