import {
  accountSettingsPath,
  getOrganizationBillingPath,
  organizationSettingsPath,
  workspaceSettingsPath,
} from "@/modules/settings/lib/routes";

// Stable, ID-free app links for marketing pages, campaigns and social posts (app.formbricks.com/billing,
// app.formbricks.com/settings/..., app.formbricks.com/contacts, ...). The proxy sends logged-out visitors
// to login and rewrites every such link to the single route handler at MARKETING_LINKS_ROUTE, which
// resolves the user's current organization (and workspace) and hands everything else to the pure
// helpers below.

/** Internal route all marketing links are rewritten to: `/marketing-links/<link>/<sub-page>`. */
export const MARKETING_LINKS_ROUTE = "/marketing-links";

/**
 * Where a link points once the user's context is known. Organization-scoped destinations only need
 * the current organization; workspace-scoped ones open inside the current workspace.
 */
export type TMarketingDestination =
  | { scope: "organization"; buildPath: (organizationId: string) => string }
  | { scope: "workspace"; buildPath: (workspaceId: string) => string };

type TMarketingSection =
  | {
      kind: "workspace" | "workspace-settings" | "account-settings";
      // Page relative to the kind's base: /workspaces/<id>/, workspace settings or account settings.
      page: string;
      // Allow-listed first sub-segments and the page each opens. Anything else opens `page`.
      subPages?: Readonly<Record<string, string>>;
    }
  // Billing on Cloud, the enterprise page on self-hosted (see `getOrganizationBillingPath`).
  | { kind: "organization-billing" };

/**
 * One row per ID-free feature link (`/<section>[/<sub-page>]`). Only these strings ever reach a
 * destination path: URL segments are matched against the allow-lists and never echoed, so an unknown,
 * extra or crafted segment just opens the section's main page.
 */
export const MARKETING_SECTIONS = {
  "embedded-data": { kind: "workspace-settings", page: "embedded-data" },
  // The enterprise page is self-hosted only (it 404s on Cloud, where plans are bought on billing).
  "enterprise-license": { kind: "organization-billing" },
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
  analysis: { kind: "workspace", page: "dashboards", subPages: { charts: "charts" } },
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

const MARKETING_LINK_ROOTS = ["billing", "settings", ...Object.keys(MARKETING_SECTIONS)].map(
  (root) => `/${root}`
);

/**
 * Whether `pathname` is one of the links above, so the proxy sends logged-out visitors to login and
 * rewrites it to MARKETING_LINKS_ROUTE. Matched per path segment, so /billing-confirmation is not one.
 */
export const isMarketingLinkPath = (pathname: string): boolean =>
  MARKETING_LINK_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));

// URL segments arrive decoded and as typed; marketing copy is not always lower-case.
const normalizeSegment = (segment: string | undefined): string => segment?.trim().toLowerCase() ?? "";

const getBillingDestination = (isFormbricksCloud: boolean): TMarketingDestination => ({
  scope: "organization",
  buildPath: (organizationId) => getOrganizationBillingPath(organizationId, isFormbricksCloud),
});

/** Resolves `/<section>/<segments...>` to its destination, falling back to the section's main page. */
export const getSectionDestination = (
  slug: TMarketingSectionSlug,
  segments: readonly string[] | undefined,
  isFormbricksCloud: boolean
): TMarketingDestination => {
  const section: TMarketingSection = MARKETING_SECTIONS[slug];
  if (section.kind === "organization-billing") return getBillingDestination(isFormbricksCloud);

  const subPages = new Map(Object.entries(section.subPages ?? {}));
  const page = (segments?.length === 1 && subPages.get(normalizeSegment(segments[0]))) || section.page;
  switch (section.kind) {
    case "workspace":
      return { scope: "workspace", buildPath: (workspaceId) => `/workspaces/${workspaceId}/${page}` };
    case "workspace-settings":
      return { scope: "workspace", buildPath: (workspaceId) => workspaceSettingsPath(workspaceId, page) };
    case "account-settings":
      // Account settings carry no ID, but still need an organization for the settings shell.
      return { scope: "organization", buildPath: () => accountSettingsPath(page) };
  }
};

// Pages /settings/<slug> can open, per settings area. Only these strings ever reach a destination: an
// unknown slug (a typo, a renamed page) opens organization General instead of a 404, and no URL segment
// is ever echoed into the path. "general" and "teams" exist in the workspace area too; /settings is
// organization settings first, so the organization pages win.
const ORGANIZATION_SETTINGS_SLUGS = new Set(["general", "teams", "api-keys", "feedback-directories"]);
// Organization pages that 404 on Cloud; there they open General instead.
const SELF_HOSTED_ORGANIZATION_SETTINGS_SLUGS = new Set(["usage", "domain"]);
const ACCOUNT_SETTINGS_SLUGS = new Set(["profile", "notifications", "authorized-apps"]);
const WORKSPACE_SETTINGS_SLUGS = new Set([
  "look",
  "languages",
  "tags",
  "embedded-data",
  "app-connection",
  "user-actions",
]);

// Bare /settings goes straight to the general page instead of the /organizations/<id>/settings index:
// that page redirects to general on its own but drops the query string, which would lose UTM params.
const DEFAULT_ORGANIZATION_SETTINGS_SLUG = "general";

export const getSettingsDestination = (
  segments: readonly string[] | undefined,
  isFormbricksCloud: boolean
): TMarketingDestination => {
  const [first = "", ...rest] = (segments ?? []).map(normalizeSegment);

  // /settings/billing and /settings/enterprise land where /billing does.
  if (first === "billing" || first === "enterprise") return getBillingDestination(isFormbricksCloud);
  if (first === "integrations") return getSectionDestination("integrations", rest, isFormbricksCloud);
  if (ACCOUNT_SETTINGS_SLUGS.has(first)) {
    return { scope: "organization", buildPath: () => accountSettingsPath(first) };
  }
  if (WORKSPACE_SETTINGS_SLUGS.has(first)) {
    return { scope: "workspace", buildPath: (workspaceId) => workspaceSettingsPath(workspaceId, first) };
  }

  const isAvailable =
    ORGANIZATION_SETTINGS_SLUGS.has(first) ||
    (!isFormbricksCloud && SELF_HOSTED_ORGANIZATION_SETTINGS_SLUGS.has(first));
  const slug = isAvailable ? first : DEFAULT_ORGANIZATION_SETTINGS_SLUG;
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

interface TMarketingRedirectInput {
  organizationId: string | undefined;
  workspaceId?: string;
  isBillingMember?: boolean;
  isFormbricksCloud: boolean;
  search: string;
  destination: TMarketingDestination;
}

/**
 * Where a logged-in user goes: without an organization to "/" (which handles setup/onboarding), a
 * workspace link without an accessible workspace to billing for billing members (who cannot open
 * workspaces) and to the organization's landing page for everyone else, otherwise to the destination.
 * The incoming query string is kept on every in-app target.
 */
export const getMarketingRedirectTarget = ({
  organizationId,
  workspaceId,
  isBillingMember = false,
  isFormbricksCloud,
  search,
  destination,
}: TMarketingRedirectInput): string => {
  if (!organizationId) return "/";
  if (destination.scope === "organization")
    return appendSearch(destination.buildPath(organizationId), search);
  if (workspaceId) return appendSearch(destination.buildPath(workspaceId), search);

  const fallback = isBillingMember
    ? getOrganizationBillingPath(organizationId, isFormbricksCloud)
    : `/organizations/${organizationId}/landing`;
  return appendSearch(fallback, search);
};

const isMarketingSectionSlug = (slug: string): slug is TMarketingSectionSlug =>
  Object.hasOwn(MARKETING_SECTIONS, slug);

/** Resolves `[<link>, ...<sub-page>]` (the path after MARKETING_LINKS_ROUTE); undefined if unknown. */
export const getMarketingDestination = (
  segments: readonly string[] | undefined,
  isFormbricksCloud: boolean
): TMarketingDestination | undefined => {
  const [link = "", ...rest] = segments ?? [];
  if (link === "billing") return getBillingDestination(isFormbricksCloud);
  if (link === "settings") return getSettingsDestination(rest, isFormbricksCloud);
  return isMarketingSectionSlug(link) ? getSectionDestination(link, rest, isFormbricksCloud) : undefined;
};
