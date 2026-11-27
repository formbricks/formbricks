import "server-only";
import { requireV3OrganizationAccess } from "@/app/api/v3/lib/organization-access";
import {
  problemConflict,
  problemDashboardAccessPlanRequired,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  DatasetViewerAccessConflictError,
  DatasetViewerAccessInvalidError,
  type TDatasetViewerAccess,
  getDatasetOrganizationId,
  getDatasetViewerAccess,
  replaceDatasetViewerAccess,
} from "@/modules/ee/dashboard-access/lib/dataset-viewer-access";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TV3DashboardViewerAccessBody } from "./schemas";

/**
 * A Feedback Dataset's Dashboard Viewer access (ENG-7476), for the v3 routes and the MCP read tool.
 * Read: an Owner or Manager session, or an API key with Access Control read. Write: Owners and Managers,
 * or an API key with Access Control write. Both need Access Control and Dashboards. A dataset of another
 * organization, or none, answers the same 403.
 */

type TParams = {
  authentication: TV3Authentication;
  datasetId: string;
  requestId: string;
  instance?: string;
};

const FORBIDDEN_DETAIL = "You are not authorized to access this resource";

export const serializeDatasetViewerAccess = (access: TDatasetViewerAccess) => ({
  datasetId: access.datasetId,
  join: access.join,
  conditions: access.conditions,
  updatedAt: access.updatedAt.toISOString(),
});

const authorize = async (
  { authentication, datasetId, requestId, instance }: TParams,
  level: "read" | "write"
): Promise<Response | { organizationId: string }> => {
  const organizationId = await getDatasetOrganizationId(datasetId);
  if (!organizationId) return problemForbidden(requestId, FORBIDDEN_DETAIL, instance);
  const access = await requireV3OrganizationAccess(
    authentication,
    organizationId,
    level,
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (!(await getIsDashboardViewerRoleEnabled(organizationId))) {
    return problemDashboardAccessPlanRequired(requestId, instance);
  }
  return access;
};

export async function getV3DatasetViewerAccess(params: TParams): Promise<Response> {
  const access = await authorize(params, "read");
  if (access instanceof Response) return access;
  const viewerAccess = await getDatasetViewerAccess(access.organizationId, params.datasetId);
  if (!viewerAccess) return problemForbidden(params.requestId, FORBIDDEN_DETAIL, params.instance);
  return successResponse(serializeDatasetViewerAccess(viewerAccess), { requestId: params.requestId });
}

export async function replaceV3DatasetViewerAccess(
  params: TParams & { body: TV3DashboardViewerAccessBody; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { requestId, instance, auditLog, body, datasetId } = params;
  const access = await authorize(params, "write");
  if (access instanceof Response) return access;
  if (auditLog) {
    auditLog.organizationId = access.organizationId;
    auditLog.targetId = datasetId;
  }

  try {
    const replaced = await replaceDatasetViewerAccess(
      access.organizationId,
      datasetId,
      { join: body.join, conditions: body.conditions },
      new Date(body.expectedUpdatedAt)
    );
    if (!replaced) return problemForbidden(requestId, FORBIDDEN_DETAIL, instance);
    if (auditLog) {
      auditLog.oldObject = { dashboardViewerAccess: serializeDatasetViewerAccess(replaced.before) };
      auditLog.newObject = { dashboardViewerAccess: serializeDatasetViewerAccess(replaced.after) };
    }
    return successResponse(serializeDatasetViewerAccess(replaced.after), { requestId });
  } catch (error) {
    if (error instanceof DatasetViewerAccessConflictError) {
      return problemConflict(requestId, "The Feedback Dataset changed since it was read", instance, {
        details: { currentUpdatedAt: error.currentUpdatedAt.toISOString() },
      });
    }
    if (error instanceof DatasetViewerAccessInvalidError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        invalid_params: error.issues,
      });
    }
    throw error;
  }
}
