import { Chart, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getChartsQuery } from "@/modules/api/v2/management/charts/lib/utils";
import { TChartInput, TGetChartsFilter } from "@/modules/api/v2/management/charts/types/charts";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";

export const getCharts = async (
  projectIds: string[],
  params: TGetChartsFilter
): Promise<Result<ApiResponseWithMeta<Chart[]>, ApiErrorResponseV2>> => {
  try {
    const query = getChartsQuery(projectIds, params);

    const [charts, count] = await prisma.$transaction([
      prisma.chart.findMany({
        ...query,
      }),
      prisma.chart.count({
        where: query.where,
      }),
    ]);

    return ok({
      data: charts,
      meta: {
        total: count,
        limit: params?.limit,
        offset: params?.skip,
      },
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "charts", issue: (error as Error).message }],
    });
  }
};

export const createChart = async (
  chartInput: TChartInput,
  createdBy?: string
): Promise<Result<Chart, ApiErrorResponseV2>> => {
  try {
    const chart = await prisma.chart.create({
      data: {
        name: chartInput.name,
        type: chartInput.type,
        projectId: chartInput.projectId,
        query: chartInput.query,
        config: chartInput.config ?? {},
        createdBy: createdBy ?? null,
      },
    });

    return ok(chart);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          type: "conflict",
          details: [{ field: "name", issue: "A chart with this name already exists in the project" }],
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
      details: [{ field: "chart", issue: (error as Error).message }],
    });
  }
};
