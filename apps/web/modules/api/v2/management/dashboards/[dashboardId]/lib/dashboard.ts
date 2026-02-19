import { Dashboard, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TDashboardUpdateInput } from "@/modules/api/v2/management/dashboards/[dashboardId]/types/dashboards";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getDashboard = async (dashboardId: string): Promise<Result<Dashboard, ApiErrorResponseV2>> => {
  try {
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
    });

    if (!dashboard) {
      return err({
        type: "not_found",
        details: [{ field: "dashboard", issue: "not found" }],
      });
    }

    return ok(dashboard);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "dashboard", issue: (error as Error).message }],
    });
  }
};

export const updateDashboard = async (
  dashboardId: string,
  dashboardInput: TDashboardUpdateInput
): Promise<Result<Dashboard, ApiErrorResponseV2>> => {
  try {
    const updatedDashboard = await prisma.dashboard.update({
      where: { id: dashboardId },
      data: dashboardInput,
    });

    return ok(updatedDashboard);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "dashboard", issue: "not found" }],
        });
      }

      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          type: "conflict",
          details: [
            { field: "name", issue: "A dashboard with this name already exists in the project" },
          ],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "dashboard", issue: (error as Error).message }],
    });
  }
};

export const deleteDashboard = async (
  dashboardId: string
): Promise<Result<Dashboard, ApiErrorResponseV2>> => {
  try {
    const deletedDashboard = await prisma.dashboard.delete({
      where: { id: dashboardId },
    });

    return ok(deletedDashboard);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "dashboard", issue: "not found" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "dashboard", issue: (error as Error).message }],
    });
  }
};
