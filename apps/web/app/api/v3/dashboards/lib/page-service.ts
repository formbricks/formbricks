import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import { type TLockedDashboard, lockDashboard } from "./dashboard-lock";
import { findIneligiblePageTeams, sameTeamLimit } from "./page-access";
import { MAX_DASHBOARD_PAGES, MAX_WIDGET_ORDER } from "./schemas";
import { type TPageResourceRow, selectPageResource } from "./service";
import { touchDashboard } from "./widget-service";

/**
 * Persistence for Dashboard pages (ENG-7480). Like every widget write, each runs in one transaction that
 * locks the dashboard first and moves its `updatedAt`, so an editor holding the dashboard from before is
 * told on save.
 */

export type TPageWriteResult =
  | { kind: "ok"; page: TPageResourceRow; previous?: { name: string; teamIds: string[] } }
  /** The dashboard already has `MAX_DASHBOARD_PAGES` pages. */
  | { kind: "full" }
  /** A team limit change by a caller who may not make one (`canManageDashboardAccess`). */
  | { kind: "accessDenied" }
  /** Teams a page of this dashboard cannot be limited to. */
  | { kind: "ineligibleTeams"; teamIds: string[] }
  /** The dashboard or page is gone, or the page belongs to another dashboard. */
  | { kind: "gone" };

const writePage = <T>(
  dashboardId: string,
  run: (tx: Prisma.TransactionClient, locked: TLockedDashboard) => Promise<T>,
  gone: T
): Promise<T> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      const locked = await lockDashboard(tx, dashboardId);
      return locked ? run(tx, locked) : gone;
    })
  );

/** Add a page last, open to all teams. */
export const createPageRow = (dashboardId: string, name: string): Promise<TPageWriteResult> =>
  writePage<TPageWriteResult>(
    dashboardId,
    async (tx, locked) => {
      const pages = await tx.dashboardPage.findMany({ where: { dashboardId }, select: { order: true } });
      if (pages.length >= MAX_DASHBOARD_PAGES) return { kind: "full" };
      const order = Math.min(
        pages.reduce((max, page) => Math.max(max, page.order), -1) + 1,
        MAX_WIDGET_ORDER
      );
      if (!(await touchDashboard(tx, dashboardId, locked))) return { kind: "gone" };
      const page = await tx.dashboardPage.create({
        data: { dashboardId, name, order },
        select: selectPageResource,
      });
      return { kind: "ok", page };
    },
    { kind: "gone" }
  );

/**
 * Rename a page, limit it to teams, or both. A team limit that changes needs `canManageAccess` — the
 * caller's `canManageDashboardAccess` — and every team it adds must be one of the page's options; an
 * unchanged limit sent back as it was needs neither. `teamIds` null or empty removes the limit.
 */
export const updatePageRow = ({
  dashboardId,
  workspaceId,
  pageId,
  name,
  teamIds,
  canManageAccess,
}: {
  dashboardId: string;
  workspaceId: string;
  pageId: string;
  name?: string;
  teamIds?: string[] | null;
  canManageAccess: boolean;
}): Promise<TPageWriteResult> =>
  writePage<TPageWriteResult>(
    dashboardId,
    async (tx, locked) => {
      const current = await tx.dashboardPage.findFirst({
        where: { id: pageId, dashboardId },
        select: selectPageResource,
      });
      if (!current) return { kind: "gone" };
      const currentTeamIds = current.teamLimits.map(({ teamId }) => teamId);

      const nextTeamIds = teamIds === undefined ? null : (teamIds ?? []);
      const limitChanges = nextTeamIds !== null && !sameTeamLimit(currentTeamIds, nextTeamIds);
      if (limitChanges) {
        if (!canManageAccess) return { kind: "accessDenied" };
        const added = nextTeamIds.filter((teamId) => !currentTeamIds.includes(teamId));
        const ineligible = await findIneligiblePageTeams(tx, { dashboardId, workspaceId, teamIds: added });
        if (ineligible.length > 0) return { kind: "ineligibleTeams", teamIds: ineligible };
      }

      if (!(await touchDashboard(tx, dashboardId, locked))) return { kind: "gone" };
      if (limitChanges) {
        await tx.dashboardPageTeam.deleteMany({ where: { pageId } });
        if (nextTeamIds.length > 0) {
          await tx.dashboardPageTeam.createMany({ data: nextTeamIds.map((teamId) => ({ pageId, teamId })) });
        }
      }
      const page = await tx.dashboardPage.update({
        where: { id: pageId },
        data: name === undefined ? { updatedAt: new Date() } : { name },
        select: selectPageResource,
      });
      return { kind: "ok", page, previous: { name: current.name, teamIds: currentTeamIds } };
    },
    { kind: "gone" }
  );

export type TPageDeleteResult =
  | { kind: "ok"; removed: { name: string; teamIds: string[]; widgetIds: string[] } }
  /** The dashboard's only page: a dashboard always has one. */
  | { kind: "lastPage" }
  | { kind: "gone" };

/** Delete a page and its widgets; the charts they showed stay. The last page cannot be deleted. */
export const deletePageRow = (dashboardId: string, pageId: string): Promise<TPageDeleteResult> =>
  writePage<TPageDeleteResult>(
    dashboardId,
    async (tx, locked) => {
      const page = await tx.dashboardPage.findFirst({
        where: { id: pageId, dashboardId },
        select: {
          name: true,
          teamLimits: { select: { teamId: true } },
          widgets: { select: { id: true } },
        },
      });
      if (!page) return { kind: "gone" };
      if ((await tx.dashboardPage.count({ where: { dashboardId } })) <= 1) return { kind: "lastPage" };

      await tx.dashboardPage.delete({ where: { id: pageId } });
      await touchDashboard(tx, dashboardId, locked);
      return {
        kind: "ok",
        removed: {
          name: page.name,
          teamIds: page.teamLimits.map(({ teamId }) => teamId),
          widgetIds: page.widgets.map(({ id }) => id),
        },
      };
    },
    { kind: "gone" }
  );
