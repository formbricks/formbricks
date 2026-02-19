import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasProjectPermission } from "@/modules/api/v2/management/charts/lib/utils";
import {
  deleteDashboard,
  getDashboard,
  updateDashboard,
} from "@/modules/api/v2/management/dashboards/[dashboardId]/lib/dashboard";
import {
  ZDashboardIdSchema,
  ZDashboardUpdateInput,
} from "@/modules/api/v2/management/dashboards/[dashboardId]/types/dashboards";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ dashboardId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ dashboardId: ZDashboardIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

      const dashboard = await getDashboard(params.dashboardId);

      if (!dashboard.ok) {
        return handleApiError(request, dashboard.error as ApiErrorResponseV2);
      }

      if (
        !hasProjectPermission(authentication.environmentPermissions, dashboard.data.projectId, "GET")
      ) {
        return handleApiError(request, {
          type: "forbidden",
          details: [{ field: "dashboard", issue: "does not have permission to access this dashboard" }],
        });
      }

      return responses.successResponse(dashboard);
    },
  });

export const PUT = async (
  request: NextRequest,
  props: { params: Promise<{ dashboardId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ dashboardId: ZDashboardIdSchema }),
      body: ZDashboardUpdateInput,
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params, body } = parsedInput;
      if (auditLog) {
        auditLog.targetId = params?.dashboardId;
      }

      if (!body || !params) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: !body ? "body" : "params", issue: "missing" }],
          },
          auditLog
        );
      }

      const dashboard = await getDashboard(params.dashboardId);

      if (!dashboard.ok) {
        return handleApiError(request, dashboard.error as ApiErrorResponseV2, auditLog);
      }

      if (
        !hasProjectPermission(authentication.environmentPermissions, dashboard.data.projectId, "PUT")
      ) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "dashboard", issue: "does not have permission to update this dashboard" }],
          },
          auditLog
        );
      }

      const updatedDashboard = await updateDashboard(params.dashboardId, body);

      if (!updatedDashboard.ok) {
        return handleApiError(request, updatedDashboard.error as ApiErrorResponseV2, auditLog); // NOSONAR
      }

      if (auditLog) {
        auditLog.oldObject = dashboard.data;
        auditLog.newObject = updatedDashboard.data;
      }

      return responses.successResponse(updatedDashboard);
    },
    action: "updated",
    targetType: "dashboard",
  });

export const DELETE = async (
  request: NextRequest,
  props: { params: Promise<{ dashboardId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ dashboardId: ZDashboardIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params } = parsedInput;
      if (auditLog) {
        auditLog.targetId = params?.dashboardId;
      }

      if (!params) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "params", issue: "missing" }],
          },
          auditLog
        );
      }

      const dashboard = await getDashboard(params.dashboardId);

      if (!dashboard.ok) {
        return handleApiError(request, dashboard.error as ApiErrorResponseV2, auditLog);
      }

      if (
        !hasProjectPermission(
          authentication.environmentPermissions,
          dashboard.data.projectId,
          "DELETE"
        )
      ) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "dashboard", issue: "does not have permission to delete this dashboard" }],
          },
          auditLog
        );
      }

      const deletedDashboard = await deleteDashboard(params.dashboardId);

      if (!deletedDashboard.ok) {
        return handleApiError(request, deletedDashboard.error as ApiErrorResponseV2, auditLog); // NOSONAR
      }

      if (auditLog) {
        auditLog.oldObject = dashboard.data;
      }

      return responses.successResponse(deletedDashboard);
    },
    action: "deleted",
    targetType: "dashboard",
  });
