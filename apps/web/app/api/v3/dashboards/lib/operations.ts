import "server-only";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  buildKeysetPage,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { type TV3DashboardOperationContext, authorizeLoadedDashboard } from "./access";
import type {
  TV3DashboardCreateBody,
  TV3DashboardDuplicateBody,
  TV3DashboardListQuery,
  TV3DashboardRenameBody,
} from "./schemas";
import { serializeV3Dashboard, serializeV3DashboardListItem } from "./serializers";
import {
  type TDashboardResourceRow,
  createDashboardRow,
  deleteDashboardRow,
  duplicateDashboardRow,
  getDashboardResourceRow,
  listDashboardRows,
  renameDashboardRow,
} from "./service";

type TV3DashboardWriteContext = TV3DashboardOperationContext & { auditLog?: TV3AuditLog };

const getSessionUserId = (authentication: TV3Authentication): string | null =>
  authentication && "user" in authentication && authentication.user?.id ? authentication.user.id : null;

/** 409 for a name another dashboard in the workspace already has. */
export const dashboardNameTaken = ({ requestId, instance }: TV3DashboardOperationContext): Response =>
  problemConflict(requestId, "A dashboard with this name already exists in this workspace.", instance);

/** A write raced a delete: the same 403 as a dashboard that never existed. */
export const isGoneError = (error: unknown): boolean =>
  isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound);

const DASHBOARDS_CURSOR_KIND = "dashboards";
const DASHBOARDS_SORT = "-createdAt";

/**
 * `GET /api/v3/dashboards` → 200 `{ data, meta: { limit, nextCursor } }`, newest first, each with a
 * `widgetCount` instead of its widgets. `filter[chartId][eq]` lists the dashboards that hold a chart.
 */
export async function listV3Dashboards({
  query,
  authentication,
  requestId,
  instance,
}: TV3DashboardOperationContext & { query: TV3DashboardListQuery }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId: query.workspaceId });

  try {
    const access = await requireDashboardsAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const filter = {
      workspaceId: access.workspaceId,
      nameContains: query["filter[name][contains]"],
      chartId: query["filter[chartId][eq]"],
    };
    const fp = computeFilterFingerprint(filter);

    let cursor: { value: string; id: string } | null = null;
    if (query.cursor) {
      try {
        cursor = decodeKeysetCursor(query.cursor, {
          kind: DASHBOARDS_CURSOR_KIND,
          sortBy: DASHBOARDS_SORT,
          fp,
        });
      } catch (error) {
        const reason = error instanceof InvalidInputError ? error.message : "The cursor is invalid.";
        return problemBadRequest(requestId, "Invalid query parameters", {
          instance,
          invalid_params: [{ name: "cursor", reason }],
        });
      }
    }

    const rows = await listDashboardRows({ filter, cursor, limit: query.limit });
    const { page, nextCursor } = buildKeysetPage({
      rows,
      limit: query.limit,
      kind: DASHBOARDS_CURSOR_KIND,
      sortBy: DASHBOARDS_SORT,
      fp,
      sortValue: (row) => row.createdAt,
    });

    return successListResponse(
      page.map(serializeV3DashboardListItem),
      { limit: query.limit, nextCursor },
      { requestId }
    );
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.list" });
  }
}

/**
 * `GET /api/v3/dashboards/{dashboardId}` → 200 `{ data }` with every widget and its full chart, so one
 * call tells a caller what is on the dashboard. Each widget then fetches its own data from the chart
 * data endpoint, so one slow chart never holds up the rest.
 */
export async function getV3Dashboard({
  dashboardId,
  ...context
}: TV3DashboardOperationContext & { dashboardId: string }): Promise<Response> {
  const log = logger.withContext({ requestId: context.requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardResourceRow(dashboardId),
      "read",
      context
    );
    if (loaded instanceof Response) return loaded;

    return successResponse(serializeV3Dashboard(loaded.row), { requestId: context.requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId: context.requestId,
      instance: context.instance,
      operation: "dashboards.get",
    });
  }
}

/**
 * `POST /api/v3/dashboards` → 201 `{ data }` with `Location`. Needs write access to the workspace; a name
 * already used there answers 409.
 */
export async function createV3Dashboard({
  body,
  auditLog,
  ...context
}: TV3DashboardWriteContext & { body: TV3DashboardCreateBody }): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  try {
    const access = await requireDashboardsAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    let row: TDashboardResourceRow;
    try {
      row = await createDashboardRow({
        workspaceId: access.workspaceId,
        name: body.name,
        createdBy: getSessionUserId(authentication),
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return dashboardNameTaken(context);
      throw error;
    }

    const dashboard = serializeV3Dashboard(row);
    if (auditLog) {
      auditLog.targetId = dashboard.id;
      auditLog.organizationId = access.organizationId;
      auditLog.newObject = dashboard;
    }

    const sessionUserId = getSessionUserId(authentication);
    if (sessionUserId) {
      capturePostHogEvent(
        sessionUserId,
        "dashboard_created",
        { dashboard_id: dashboard.id },
        { organizationId: access.organizationId, workspaceId: access.workspaceId }
      );
    }

    return createdResponse(dashboard, { location: `/api/v3/dashboards/${dashboard.id}`, requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.create" });
  }
}

/**
 * `PATCH /api/v3/dashboards/{dashboardId}` → 200 `{ data }`: a rename, which moves `updatedAt` so an
 * editor holding the dashboard from before is told on save. The layout is saved with `PUT`.
 */
export async function renameV3Dashboard({
  dashboardId,
  body,
  auditLog,
  ...context
}: TV3DashboardWriteContext & { dashboardId: string; body: TV3DashboardRenameBody }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardResourceRow(dashboardId),
      "readWrite",
      context
    );
    if (loaded instanceof Response) return loaded;

    let row: TDashboardResourceRow;
    try {
      row = await renameDashboardRow(dashboardId, body.name);
    } catch (error) {
      if (isUniqueConstraintError(error)) return dashboardNameTaken(context);
      if (isGoneError(error)) return problemForbidden(requestId, undefined, instance);
      throw error;
    }

    const dashboard = serializeV3Dashboard(row);
    if (auditLog) {
      auditLog.targetId = dashboard.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.oldObject = { id: loaded.row.id, name: loaded.row.name };
      auditLog.newObject = { id: dashboard.id, name: dashboard.name };
    }

    return successResponse(dashboard, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.rename" });
  }
}

/** How often a generated "(copy)" name is retried when a concurrent copy took it first. */
const MAX_COPY_NAME_ATTEMPTS = 3;

/**
 * `POST /api/v3/dashboards/{dashboardId}/duplicate` → 201 `{ data }` with `Location`.
 *
 * The copy shares the original's charts: its widgets point at the same charts, in the same layout, so an
 * edit to one of those charts shows on both dashboards. Duplicate a chart and repoint the copy's widget
 * to change it for one dashboard only.
 */
export async function duplicateV3Dashboard({
  dashboardId,
  body,
  auditLog,
  ...context
}: TV3DashboardWriteContext & { dashboardId: string; body: TV3DashboardDuplicateBody }): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardResourceRow(dashboardId),
      "readWrite",
      context
    );
    if (loaded instanceof Response) return loaded;

    let row: TDashboardResourceRow | null = null;
    for (let attempt = 1; ; attempt++) {
      try {
        row = await duplicateDashboardRow({
          sourceId: dashboardId,
          name: body.name,
          createdBy: getSessionUserId(authentication),
        });
        break;
      } catch (error) {
        // A name the caller chose is theirs to change; a generated one is retried, since a concurrent
        // copy taking it first is the only way it can clash.
        if (
          isUniqueConstraintError(error) &&
          (body.name !== undefined || attempt >= MAX_COPY_NAME_ATTEMPTS)
        ) {
          return dashboardNameTaken(context);
        }
        if (!isUniqueConstraintError(error)) throw error;
      }
    }
    if (!row) return problemForbidden(requestId, undefined, instance);

    const dashboard = serializeV3Dashboard(row);
    if (auditLog) {
      auditLog.targetId = dashboard.id;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.newObject = { ...dashboard, duplicatedFrom: dashboardId };
    }

    return createdResponse(dashboard, { location: `/api/v3/dashboards/${dashboard.id}`, requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.duplicate" });
  }
}

/**
 * `DELETE /api/v3/dashboards/{dashboardId}` → 204. Its widgets go with it; every chart stays, including
 * charts no other dashboard holds.
 */
export async function deleteV3Dashboard({
  dashboardId,
  auditLog,
  ...context
}: TV3DashboardWriteContext & { dashboardId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const loaded = await authorizeLoadedDashboard(
      await getDashboardResourceRow(dashboardId),
      "readWrite",
      context
    );
    if (loaded instanceof Response) return loaded;

    try {
      await deleteDashboardRow(dashboardId);
    } catch (error) {
      if (isGoneError(error)) return problemForbidden(requestId, undefined, instance);
      throw error;
    }

    if (auditLog) {
      auditLog.targetId = dashboardId;
      auditLog.organizationId = loaded.access.organizationId;
      auditLog.oldObject = serializeV3Dashboard(loaded.row);
    }

    return noContentResponse({ requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.delete" });
  }
}
