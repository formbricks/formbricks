import { NextRequest } from "next/server";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasProjectPermission } from "@/modules/api/v2/management/charts/lib/utils";
import { createDashboard, getDashboards } from "@/modules/api/v2/management/dashboards/lib/dashboard";
import {
  ZDashboardInput,
  ZGetDashboardsFilter,
} from "@/modules/api/v2/management/dashboards/types/dashboards";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetDashboardsFilter.sourceType(),
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      if (!query) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      const projectIds = [
        ...new Set(authentication.environmentPermissions.map((permission) => permission.projectId)),
      ];

      if (query.projectId && !projectIds.includes(query.projectId)) {
        return handleApiError(request, {
          type: "forbidden",
          details: [{ field: "projectId", issue: "does not have permission to access this project" }],
        });
      }

      const filteredProjectIds = query.projectId ? [query.projectId] : projectIds;

      const res = await getDashboards(filteredProjectIds, query);

      if (res.ok) {
        return responses.successResponse(res.data);
      }

      return handleApiError(request, res.error);
    },
  });

export const POST = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZDashboardInput,
    },
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { body } = parsedInput;

      if (!body) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "body", issue: "missing" }],
          },
          auditLog
        );
      }

      if (!hasProjectPermission(authentication.environmentPermissions, body.projectId, "POST")) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "projectId", issue: "does not have permission to create dashboard" }],
          },
          auditLog
        );
      }

      const createDashboardResult = await createDashboard(body);

      if (!createDashboardResult.ok) {
        return handleApiError(request, createDashboardResult.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = createDashboardResult.data.id;
        auditLog.newObject = createDashboardResult.data;
      }

      return responses.createdResponse(createDashboardResult);
    },
    action: "created",
    targetType: "dashboard",
  });
