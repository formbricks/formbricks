import { Chart, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TChartUpdateInput } from "@/modules/api/v2/management/charts/[chartId]/types/charts";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getChart = async (chartId: string): Promise<Result<Chart, ApiErrorResponseV2>> => {
  try {
    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
    });

    if (!chart) {
      return err({
        type: "not_found",
        details: [{ field: "chart", issue: "not found" }],
      });
    }

    return ok(chart);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "chart", issue: (error as Error).message }],
    });
  }
};

export const updateChart = async (
  chartId: string,
  chartInput: TChartUpdateInput
): Promise<Result<Chart, ApiErrorResponseV2>> => {
  try {
    const updatedChart = await prisma.chart.update({
      where: { id: chartId },
      data: chartInput,
    });

    return ok(updatedChart);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "chart", issue: "not found" }],
        });
      }

      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          type: "conflict",
          details: [{ field: "name", issue: "A chart with this name already exists in the project" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "chart", issue: (error as Error).message }],
    });
  }
};

export const deleteChart = async (chartId: string): Promise<Result<Chart, ApiErrorResponseV2>> => {
  try {
    const deletedChart = await prisma.chart.delete({
      where: { id: chartId },
    });

    return ok(deletedChart);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "chart", issue: "not found" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "chart", issue: (error as Error).message }],
    });
  }
};
