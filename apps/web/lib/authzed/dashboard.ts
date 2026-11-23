import "server-only";
import type {
  TAuthzedClient,
  TAuthzedRelationship,
  TAuthzedRelationshipFilter,
  TAuthzedRelationshipUpdate,
} from "./client";
import { getAuthzedClient } from "./client";
import {
  type TDashboardPageProjectionRow,
  type TDashboardProjectionRow,
  dashboardRelationshipKey,
  expectedDashboardPageRelationships,
  expectedDashboardRelationships,
} from "./dashboard-relationships";
import { readDashboardPageProjectionRows, readDashboardProjectionRows } from "./dashboard-source";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { deleteRelationshipsInBoundedBatches, packRelationshipUpdateGroups } from "./relationship-batches";
import { readAllRelationships } from "./relationship-reads";

export {
  expectedDashboardPageRelationships,
  expectedDashboardRelationships,
  type TDashboardPageProjectionRow,
  type TDashboardProjectionRow,
} from "./dashboard-relationships";

/**
 * Dashboards and their pages, projected from PostgreSQL into SpiceDB (ADR-0059).
 *
 * PostgreSQL is the durable source: `Dashboard.workspaceId`, `TeamDashboard` (narrowed to the teams that
 * still hold the dashboard's workspace), `DashboardPage.dashboardId` and `DashboardPageTeam`. The graph
 * never holds a fact on its own, so a rebuild from an empty graph restores everything.
 *
 * Each resource is reconciled to exactly the set its row implies: every expected edge is touched and
 * every other edge on the resource deleted, in one write per resource, so a page never sits between
 * losing `open_on` and gaining its `limited_team` edges. Like the team reconciler, a pass re-reads the
 * rows after writing and repeats while they moved, so a change committed mid-pass is not lost.
 *
 * The team self-marker (`team#dashboard_limited`) is the team reconciler's (`./team-workspace`): that
 * reconciler owns every edge on a `team` resource.
 */

export type TDashboardProjectionTargets = Readonly<{
  dashboardIds?: ReadonlyArray<string>;
  pageIds?: ReadonlyArray<string>;
}>;

type TDashboardSnapshot = Readonly<{
  dashboards: ReadonlyArray<TDashboardProjectionRow>;
  pages: ReadonlyArray<TDashboardPageProjectionRow>;
}>;

/**
 * Updates that turn `current` into exactly `expected`: touch everything expected, delete everything
 * else observed on the resource. Pure so the diff is testable without a graph.
 */
export const diffDashboardRelationships = (
  current: ReadonlyArray<TAuthzedRelationship>,
  expected: ReadonlyArray<TAuthzedRelationship>
): TAuthzedRelationshipUpdate[] => {
  const expectedKeys = new Set(expected.map(dashboardRelationshipKey));

  return [
    ...expected.map((relationship): TAuthzedRelationshipUpdate => ({ operation: "touch", relationship })),
    ...current
      .filter((relationship) => !expectedKeys.has(dashboardRelationshipKey(relationship)))
      .map((relationship): TAuthzedRelationshipUpdate => ({ operation: "delete", relationship })),
  ];
};

const sortedUnique = (ids: ReadonlyArray<string> | undefined): ReadonlyArray<string> =>
  [...new Set(ids ?? [])].sort((left, right) => left.localeCompare(right));

const readSnapshot = async (
  dashboardIds: ReadonlyArray<string>,
  pageIds: ReadonlyArray<string>
): Promise<TDashboardSnapshot> => {
  const [dashboards, pages] = await Promise.all([
    dashboardIds.length === 0 ? [] : readDashboardProjectionRows({ id: { in: [...dashboardIds] } }),
    pageIds.length === 0 ? [] : readDashboardPageProjectionRows({ id: { in: [...pageIds] } }),
  ]);
  return { dashboards, pages };
};

/**
 * One update group per resource: its whole diff, so the write that adds a page's limit is the write
 * that removes its `open_on` edge.
 */
const resourceUpdateGroup = async (
  client: TAuthzedClient,
  resourceType: "dashboard" | "dashboard_page",
  resourceId: string,
  expected: ReadonlyArray<TAuthzedRelationship>
): Promise<TAuthzedRelationshipUpdate[]> => {
  const { relationships: current } = await readAllRelationships(client, { resourceId, resourceType });
  return diffDashboardRelationships(current, expected);
};

const writeSnapshot = async (
  client: TAuthzedClient,
  dashboardIds: ReadonlyArray<string>,
  pageIds: ReadonlyArray<string>,
  snapshot: TDashboardSnapshot
): Promise<void> => {
  const dashboardsById = new Map(snapshot.dashboards.map((row) => [row.id, row]));
  const pagesById = new Map(snapshot.pages.map((row) => [row.id, row]));
  const updateGroups: TAuthzedRelationshipUpdate[][] = [];
  const deletionFilters: TAuthzedRelationshipFilter[] = [];

  // Sequential: one resource's relationships in flight at a time keeps a large chunk from fanning out
  // into as many concurrent reads.
  for (const dashboardId of dashboardIds) {
    const row = dashboardsById.get(dashboardId);
    if (!row) {
      // A deleted dashboard is not a revocation (see the trigger migration): every dashboard decision
      // resolves the row first. Its pages point at it too; their own DELETE events remove them one by
      // one, and this clears them in a single subject-wide delete as well.
      deletionFilters.push(
        { resourceId: dashboardId, resourceType: "dashboard" },
        dashboardPageRelationshipsOnDashboardFilter(dashboardId)
      );
      continue;
    }
    updateGroups.push(
      await resourceUpdateGroup(client, "dashboard", dashboardId, expectedDashboardRelationships(row)) // NOSONAR
    );
  }
  for (const pageId of pageIds) {
    const row = pagesById.get(pageId);
    if (!row) {
      deletionFilters.push({ resourceId: pageId, resourceType: "dashboard_page" });
      continue;
    }
    updateGroups.push(
      await resourceUpdateGroup(client, "dashboard_page", pageId, expectedDashboardPageRelationships(row)) // NOSONAR
    );
  }

  for (const batch of packRelationshipUpdateGroups(updateGroups.filter((group) => group.length > 0))) {
    await client.writeRelationships(batch); // NOSONAR
  }
  await deleteRelationshipsInBoundedBatches(client, deletionFilters);
};

const snapshotsMatch = (left: TDashboardSnapshot, right: TDashboardSnapshot): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Converge each named dashboard's and page's relationships to what PostgreSQL implies. Never throws:
 * failures come back as `{ status: "failed" }`, so callers must inspect the result.
 */
export const reconcileDashboardRelationships = (
  targets: TDashboardProjectionTargets
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_dashboard_relationships", "dashboard", async () => {
    const dashboardIds = sortedUnique(targets.dashboardIds);
    const pageIds = sortedUnique(targets.pageIds);
    if (dashboardIds.length === 0 && pageIds.length === 0) {
      return 0;
    }

    const client = getAuthzedClient();
    for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
      const sourceSnapshot = await readSnapshot(dashboardIds, pageIds);
      await writeSnapshot(client, dashboardIds, pageIds, sourceSnapshot);

      if (snapshotsMatch(sourceSnapshot, await readSnapshot(dashboardIds, pageIds))) {
        return pass;
      }
    }

    throw new AuthzedProjectionUnstableError();
  });

/** Every page's dashboard edges onto one dashboard, by subject — for a deleted dashboard. */
export const dashboardPageRelationshipsOnDashboardFilter = (
  dashboardId: string
): TAuthzedRelationshipFilter => ({
  resourceType: "dashboard_page",
  subject: { objectId: dashboardId, objectType: "dashboard" },
});

/**
 * Every dashboard's workspace edge onto one workspace, by subject — for a deleted workspace. Selection
 * edges left behind grant nothing: `selected_by_team` intersects `workspace->dashboard_read`, now empty.
 */
export const dashboardRelationshipsOnWorkspaceFilter = (workspaceId: string): TAuthzedRelationshipFilter => ({
  resourceType: "dashboard",
  subject: { objectId: workspaceId, objectType: "workspace" },
});
