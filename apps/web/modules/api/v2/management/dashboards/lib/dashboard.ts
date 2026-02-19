import { Dashboard, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getDashboardsQuery } from "@/modules/api/v2/management/dashboards/lib/utils";
import {
  TDashboardInput,
  TGetDashboardsFilter,
} from "@/modules/api/v2/management/dashboards/types/dashboards";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";

export const getDashboards = async (
  projectIds: string[],
  params: TGetDashboardsFilter
): Promise<Result<ApiResponseWithMeta<Dashboard[]>, ApiErrorResponseV2>> => {
  try {
    const query = getDashboardsQuery(projectIds, params);

    const [dashboards, count] = await prisma.$transaction([
      prisma.dashboard.findMany({
        ...query,
      }),
      prisma.dashboard.count({
        where: query.where,
      }),
    ]);

    return ok({
      data: dashboards,
      meta: {
        total: count,
        limit: params?.limit,
        offset: params?.skip,
      },
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "dashboards", issue: (error as Error).message }],
    });
  }
};

export const createDashboard = async (
  dashboardInput: TDashboardInput,
  createdBy?: string
): Promise<Result<Dashboard, ApiErrorResponseV2>> => {
  try {
    const dashboard = await prisma.dashboard.create({
      data: {
        name: dashboardInput.name,
        description: dashboardInput.description ?? null,
        projectId: dashboardInput.projectId,
        createdBy: createdBy ?? null,
      },
    });

    return ok(dashboard);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          type: "conflict",
          details: [
            { field: "name", issue: "A dashboard with this name already exists in the project" },
          ],
        });
      }

      if (error.code === PrismaErrorType.RelatedRecordDoesNotExist) {
        return err({
          type: "not_found",
          details: [{ field: "projectId", issue: "Project not found" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "dashboard", issue: (error as Error).message }],
    });
  }
};
