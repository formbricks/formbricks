import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  deleteChart,
  getChart,
  updateChart,
} from "@/modules/api/v2/management/charts/[chartId]/lib/chart";
import {
  ZChartIdSchema,
  ZChartUpdateInput,
} from "@/modules/api/v2/management/charts/[chartId]/types/charts";
import { hasProjectPermission } from "@/modules/api/v2/management/charts/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const GET = async (request: NextRequest, props: { params: Promise<{ chartId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ chartId: ZChartIdSchema }),
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

      const chart = await getChart(params.chartId);

      if (!chart.ok) {
        return handleApiError(request, chart.error as ApiErrorResponseV2);
      }

      if (!hasProjectPermission(authentication.environmentPermissions, chart.data.projectId, "GET")) {
        return handleApiError(request, {
          type: "forbidden",
          details: [{ field: "chart", issue: "does not have permission to access this chart" }],
        });
      }

      return responses.successResponse(chart);
    },
  });

export const PUT = async (request: NextRequest, props: { params: Promise<{ chartId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ chartId: ZChartIdSchema }),
      body: ZChartUpdateInput,
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params, body } = parsedInput;
      if (auditLog) {
        auditLog.targetId = params?.chartId;
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

      const chart = await getChart(params.chartId);

      if (!chart.ok) {
        return handleApiError(request, chart.error as ApiErrorResponseV2, auditLog);
      }

      if (!hasProjectPermission(authentication.environmentPermissions, chart.data.projectId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "chart", issue: "does not have permission to update this chart" }],
          },
          auditLog
        );
      }

      const updatedChart = await updateChart(params.chartId, body);

      if (!updatedChart.ok) {
        return handleApiError(request, updatedChart.error as ApiErrorResponseV2, auditLog); // NOSONAR
      }

      if (auditLog) {
        auditLog.oldObject = chart.data;
        auditLog.newObject = updatedChart.data;
      }

      return responses.successResponse(updatedChart);
    },
    action: "updated",
    targetType: "chart",
  });

export const DELETE = async (request: NextRequest, props: { params: Promise<{ chartId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ chartId: ZChartIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params } = parsedInput;
      if (auditLog) {
        auditLog.targetId = params?.chartId;
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

      const chart = await getChart(params.chartId);

      if (!chart.ok) {
        return handleApiError(request, chart.error as ApiErrorResponseV2, auditLog);
      }

      if (!hasProjectPermission(authentication.environmentPermissions, chart.data.projectId, "DELETE")) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "chart", issue: "does not have permission to delete this chart" }],
          },
          auditLog
        );
      }

      const deletedChart = await deleteChart(params.chartId);

      if (!deletedChart.ok) {
        return handleApiError(request, deletedChart.error as ApiErrorResponseV2, auditLog); // NOSONAR
      }

      if (auditLog) {
        auditLog.oldObject = chart.data;
      }

      return responses.successResponse(deletedChart);
    },
    action: "deleted",
    targetType: "chart",
  });
