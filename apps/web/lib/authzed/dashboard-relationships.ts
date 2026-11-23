import "server-only";
import type { TAuthzedRelationship } from "./client";
import {
  DASHBOARD_PAGE_RELATIONS,
  DASHBOARD_RELATIONS,
  TEAM_DASHBOARD_LIMITED_RELATION,
} from "./relationship-map";

/**
 * The relationship sets dashboards, their pages and team dashboard limits imply (ADR-0059). Pure, and
 * free of the client and PostgreSQL, so the projector (`./dashboard`), the team reconciler and the
 * read-only backfill audit derive the expected sets from one place.
 */

/**
 * A dashboard's projected facts. `selectedByTeamIds` holds only the teams whose `TeamDashboard` row names
 * the dashboard AND that still hold a `WorkspaceTeam` on the dashboard's workspace in its organization:
 * a selection without that grant is ignored (ADR-0059), so it is never written.
 */
export type TDashboardProjectionRow = Readonly<{
  id: string;
  selectedByTeamIds: ReadonlyArray<string>;
  workspaceId: string;
}>;

/**
 * A dashboard page's projected facts. `limitedTeamIds` holds the page's `DashboardPageTeam` teams of the
 * dashboard's own organization; an empty list means the page has no team limit.
 */
export type TDashboardPageProjectionRow = Readonly<{
  dashboardId: string;
  id: string;
  limitedTeamIds: ReadonlyArray<string>;
}>;

const sortedUnique = (ids: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(ids)].sort((left, right) => (left < right ? -1 : Number(left > right)));

/**
 * The exact relationship set a dashboard row implies.
 *
 * | Fact                                       | Edge                                     |
 * | ------------------------------------------ | ---------------------------------------- |
 * | always                                     | `dashboard#workspace@workspace:W`        |
 * | `TeamDashboard(T)`, T granted on W         | `dashboard#selected_by_team@team:T`      |
 *
 * Cross-tenant guard: the only workspace this can ever name is `row.workspaceId`.
 */
export const expectedDashboardRelationships = (row: TDashboardProjectionRow): TAuthzedRelationship[] => {
  const resource = { objectId: row.id, objectType: "dashboard" } as const;
  return [
    {
      relation: DASHBOARD_RELATIONS.workspace,
      resource,
      subject: { objectId: row.workspaceId, objectType: "workspace" },
    },
    ...sortedUnique(row.selectedByTeamIds).map(
      (teamId): TAuthzedRelationship => ({
        relation: DASHBOARD_RELATIONS.selectedByTeam,
        resource,
        subject: { objectId: teamId, objectType: "team" },
      })
    ),
  ];
};

/**
 * The exact relationship set a dashboard page row implies.
 *
 * | Fact                        | Edge                                       |
 * | --------------------------- | ------------------------------------------ |
 * | always                      | `dashboard_page#dashboard@dashboard:D`     |
 * | no `DashboardPageTeam` row  | `dashboard_page#open_on@dashboard:D`       |
 * | `DashboardPageTeam(T)`      | `dashboard_page#limited_team@team:T`       |
 *
 * `open_on` and `limited_team` never coexist: a page is either open to every reader of its dashboard
 * or limited to its teams, so the projector removes one in the same write that adds the other.
 */
export const expectedDashboardPageRelationships = (
  row: TDashboardPageProjectionRow
): TAuthzedRelationship[] => {
  const resource = { objectId: row.id, objectType: "dashboard_page" } as const;
  const dashboard = { objectId: row.dashboardId, objectType: "dashboard" } as const;
  const limitedTeamIds = sortedUnique(row.limitedTeamIds);
  const relationships: TAuthzedRelationship[] = [
    { relation: DASHBOARD_PAGE_RELATIONS.dashboard, resource, subject: dashboard },
  ];

  if (limitedTeamIds.length === 0) {
    relationships.push({ relation: DASHBOARD_PAGE_RELATIONS.openOn, resource, subject: dashboard });
  }
  for (const teamId of limitedTeamIds) {
    relationships.push({
      relation: DASHBOARD_PAGE_RELATIONS.limitedTeam,
      resource,
      subject: { objectId: teamId, objectType: "team" },
    });
  }

  return relationships;
};

/** The team self-marker a team with a dashboard limit carries (`team:T#dashboard_limited@team:T`). */
export const teamDashboardLimitedRelationship = (teamId: string): TAuthzedRelationship => ({
  relation: TEAM_DASHBOARD_LIMITED_RELATION,
  resource: { objectId: teamId, objectType: "team" },
  subject: { objectId: teamId, objectType: "team" },
});

/**
 * Narrow raw `TeamDashboard` selections to the teams a dashboard's projection names: teams of the
 * dashboard's organization that hold a grant on its workspace. `grantedPairs` holds
 * `teamId:workspaceId` keys of the `WorkspaceTeam` rows read alongside.
 */
export const toDashboardProjectionRow = (
  dashboard: Readonly<{
    id: string;
    organizationId: string;
    teamLimits: ReadonlyArray<Readonly<{ team: Readonly<{ organizationId: string }>; teamId: string }>>;
    workspaceId: string;
  }>,
  grantedPairs: ReadonlySet<string>
): TDashboardProjectionRow => ({
  id: dashboard.id,
  selectedByTeamIds: sortedUnique(
    dashboard.teamLimits
      .filter(
        ({ team, teamId }) =>
          team.organizationId === dashboard.organizationId &&
          grantedPairs.has(teamWorkspacePairKey(teamId, dashboard.workspaceId))
      )
      .map(({ teamId }) => teamId)
  ),
  workspaceId: dashboard.workspaceId,
});

/** Narrow a page's raw `DashboardPageTeam` rows to the teams of its dashboard's organization. */
export const toDashboardPageProjectionRow = (
  page: Readonly<{
    dashboardId: string;
    id: string;
    organizationId: string;
    teamLimits: ReadonlyArray<Readonly<{ team: Readonly<{ organizationId: string }>; teamId: string }>>;
  }>
): TDashboardPageProjectionRow => ({
  dashboardId: page.dashboardId,
  id: page.id,
  limitedTeamIds: sortedUnique(
    page.teamLimits
      .filter(({ team }) => team.organizationId === page.organizationId)
      .map(({ teamId }) => teamId)
  ),
});

/** The key `toDashboardProjectionRow` looks a `WorkspaceTeam` grant up by. */
export const teamWorkspacePairKey = (teamId: string, workspaceId: string): string =>
  `${teamId.length}:${teamId}${workspaceId}`;

/** An edge's identity for set comparisons: relation, resource and subject, including a subject relation. */
export const dashboardRelationshipKey = ({ relation, resource, subject }: TAuthzedRelationship): string =>
  JSON.stringify([
    relation,
    resource.objectType,
    resource.objectId,
    subject.objectType,
    subject.objectId,
    subject.relation ?? "",
  ]);
