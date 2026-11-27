import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  createdResponse,
  noContentResponse,
  problemConflict,
  problemForbidden,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { type TV3DashboardOperationContext, authorizeLoadedDashboard } from "./access";
import {
  canManageDashboardAccess,
  getPageTeamOptions,
  ineligiblePageTeams,
  pageAccessDenied,
} from "./page-access";
import { type TPageWriteResult, createPageRow, deletePageRow, updatePageRow } from "./page-service";
import { MAX_DASHBOARD_PAGES, type TV3PageCreateBody, type TV3PageUpdateBody } from "./schemas";
import { serializeV3DashboardPage } from "./serializers";
import { getDashboardWorkspaceRow } from "./service";

/**
 * The Dashboard page operations (ENG-7480): add, rename, limit to teams, delete. Each needs write access
 * to the dashboard's workspace, like every dashboard edit; a team limit change also needs
 * `canManageDashboardAccess` (Owners and Managers, with Access Control), and is audited with the page's
 * previous and new teams. Pages are reordered by the whole-dashboard save.
 */

type TV3PageWriteContext = TV3DashboardOperationContext & { auditLog?: TV3AuditLog };

const loadDashboardForWrite = async (dashboardId: string, context: TV3DashboardOperationContext) =>
  authorizeLoadedDashboard(await getDashboardWorkspaceRow(dashboardId), "readWrite", context);

/** A page write that did not happen, as the response that says why. */
const refusePageWrite = (
  result: Exclude<TPageWriteResult, { kind: "ok" }>,
  context: TV3DashboardOperationContext
): Response => {
  switch (result.kind) {
    case "full":
      return problemConflict(
        context.requestId,
        `This dashboard already has ${MAX_DASHBOARD_PAGES} pages, the most it can. Delete one first.`,
        context.instance
      );
    case "accessDenied":
      return pageAccessDenied(context);
    case "ineligibleTeams":
      return ineligiblePageTeams(result.teamIds, context);
    case "gone":
      return problemForbidden(context.requestId, undefined, context.instance);
  }
};

/** `POST /api/v3/dashboards/{dashboardId}/pages` → 201 `{ data }`: a new page, last, open to all teams. */
export async function createV3DashboardPage({
  dashboardId,
  body,
  auditLog,
  ...context
}: TV3PageWriteContext & { dashboardId: string; body: TV3PageCreateBody }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await loadDashboardForWrite(dashboardId, context);
    if (loaded instanceof Response) return loaded;

    const result = await createPageRow(dashboardId, body.name);
    if (result.kind !== "ok") return refusePageWrite(result, context);

    const page = serializeV3DashboardPage(result.page);
    if (auditLog) {
      auditLog.targetId = page.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.newObject = { dashboardId, ...page };
    }
    return createdResponse(page, {
      location: `/api/v3/dashboards/${dashboardId}/pages/${page.id}`,
      requestId,
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.pages.create" });
  }
}

/**
 * `PATCH /api/v3/dashboards/{dashboardId}/pages/{pageId}` → 200 `{ data }`: rename, set the team limit, or
 * both. A limit sent back unchanged needs no more than the rename does.
 */
export async function updateV3DashboardPage({
  dashboardId,
  pageId,
  body,
  auditLog,
  ...context
}: TV3PageWriteContext & {
  dashboardId: string;
  pageId: string;
  body: TV3PageUpdateBody;
}): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId, pageId });

  try {
    const loaded = await loadDashboardForWrite(dashboardId, context);
    if (loaded instanceof Response) return loaded;

    const result = await updatePageRow({
      dashboardId,
      workspaceId: loaded.access.workspaceId,
      pageId,
      name: body.name,
      teamIds: body.teamIds,
      canManageAccess:
        body.teamIds === undefined
          ? false
          : await canManageDashboardAccess(context.authentication, dashboardId, loaded.access.organizationId),
    });
    if (result.kind !== "ok") return refusePageWrite(result, context);

    const page = serializeV3DashboardPage(result.page);
    if (auditLog) {
      auditLog.targetId = page.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.oldObject = { dashboardId, id: page.id, ...result.previous };
      auditLog.newObject = { dashboardId, ...page };
    }
    return successResponse(page, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.pages.update" });
  }
}

/**
 * `DELETE /api/v3/dashboards/{dashboardId}/pages/{pageId}` → 204. The page's widgets go with it; the charts
 * they showed stay. A dashboard keeps at least one page: deleting the last answers 409.
 */
export async function deleteV3DashboardPage({
  dashboardId,
  pageId,
  auditLog,
  ...context
}: TV3PageWriteContext & { dashboardId: string; pageId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId, pageId });

  try {
    const loaded = await loadDashboardForWrite(dashboardId, context);
    if (loaded instanceof Response) return loaded;

    const result = await deletePageRow(dashboardId, pageId);
    if (result.kind === "gone") return problemForbidden(requestId, undefined, instance);
    if (result.kind === "lastPage") {
      return problemConflict(
        requestId,
        "This is the dashboard's only page. A dashboard keeps at least one page: add another before deleting this one.",
        instance
      );
    }

    if (auditLog) {
      auditLog.targetId = pageId;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.oldObject = { dashboardId, id: pageId, ...result.removed };
    }
    return noContentResponse({ requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.pages.delete" });
  }
}

/**
 * `GET /api/internal/dashboards/{dashboardId}/page-access` → 200 `{ data }`: what the app's Manage pages
 * dialog needs to show page team limits — whether this person may change them (`canManageAccess`, the
 * same gate the writes use), and the teams to show: every team a page may be limited to for someone who
 * may change them, otherwise only the teams the pages are already limited to, so their chips have names.
 * Needs write access to the dashboard, as the dialog is part of editing it.
 */
export async function getV3DashboardPageAccess({
  dashboardId,
  ...context
}: TV3DashboardOperationContext & { dashboardId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await loadDashboardForWrite(dashboardId, context);
    if (loaded instanceof Response) return loaded;
    const { workspaceId, organizationId } = loaded.access;

    const [canManageAccess, limiting] = await Promise.all([
      canManageDashboardAccess(context.authentication, dashboardId, organizationId),
      prisma.team.findMany({
        where: { pageLimits: { some: { page: { dashboardId } } } },
        select: { id: true, name: true },
      }),
    ]);
    const options = canManageAccess ? await getPageTeamOptions(prisma, { dashboardId, workspaceId }) : [];
    // A team a page is already limited to keeps its chip, even once it is no longer an option to add.
    const known = new Set(options.map(({ id }) => id));
    const teams = [
      ...options.map((team) => ({ ...team, selectable: true })),
      ...limiting.filter(({ id }) => !known.has(id)).map((team) => ({ ...team, selectable: false })),
    ].sort((a, b) => a.name.localeCompare(b.name));
    return successResponse({ canManageAccess, teams }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.pages.access" });
  }
}
