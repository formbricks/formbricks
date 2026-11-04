import type { TOrganizationRole } from "@formbricks/types/memberships";

/**
 * Where picking an organization in a switcher leads — the one rule for the main navigation, the settings
 * sidebar and the organization breadcrumb. The current organization opens its settings; any other goes
 * through its redirect route, which lands each role on its home there. A Dashboard viewer has no
 * organization settings (ADR-0023), so its current organization goes through the redirect route as well.
 */
export const getOrganizationSwitchPath = ({
  organizationId,
  currentOrganizationId,
  membershipRole,
}: Readonly<{
  organizationId: string;
  currentOrganizationId: string;
  /** The person's role in the current organization. */
  membershipRole: TOrganizationRole | undefined;
}>): string =>
  organizationId === currentOrganizationId && membershipRole !== "dashboard_viewer"
    ? `/organizations/${organizationId}/settings/general`
    : `/organizations/${organizationId}/`;

/**
 * Where a workspace's home is for someone of `role` — the one rule for the main navigation's home link,
 * the workspace switchers and the workspace breadcrumb. A Dashboard viewer only has dashboards
 * (ADR-0023); a Billing member goes through the workspace route, which sends it to billing.
 */
export const getWorkspaceHomePath = (role: TOrganizationRole | undefined, workspaceId: string): string => {
  if (role === "dashboard_viewer") return `/workspaces/${workspaceId}/dashboards`;
  if (role === "billing") return `/workspaces/${workspaceId}/`;
  return `/workspaces/${workspaceId}/surveys`;
};
