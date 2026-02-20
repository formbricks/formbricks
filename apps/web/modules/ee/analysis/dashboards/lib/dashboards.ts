import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { selectChart } from "@/modules/ee/analysis/charts/lib/charts";
import {
  TAddWidgetInput,
  TDashboard,
  TDashboardCreateInput,
  TDashboardUpdateInput,
  TDashboardWithCount,
  ZAddWidgetInput,
  ZDashboardCreateInput,
  ZDashboardUpdateInput,
} from "../../types/analysis";

const selectDashboard = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const createDashboard = async (data: TDashboardCreateInput): Promise<TDashboard> => {
  validateInputs([data, ZDashboardCreateInput]);

  try {
    return await prisma.dashboard.create({
      data: {
        name: data.name,
        description: data.description,
        projectId: data.projectId,
        createdBy: data.createdBy,
      },
      select: selectDashboard,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A dashboard with this name already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateDashboard = async (
  dashboardId: string,
  projectId: string,
  data: TDashboardUpdateInput
): Promise<{ dashboard: TDashboard; updatedDashboard: TDashboard }> => {
  validateInputs([dashboardId, ZId], [projectId, ZId], [data, ZDashboardUpdateInput]);

  try {
    return await prisma.$transaction(async (tx) => {
      const dashboard = await tx.dashboard.findFirst({
        where: { id: dashboardId, projectId },
        select: selectDashboard,
      });

      if (!dashboard) {
        throw new ResourceNotFoundError("Dashboard", dashboardId);
      }

      const updatedDashboard = await tx.dashboard.update({
        where: { id: dashboardId },
        data: {
          name: data.name,
          description: data.description,
        },
        select: selectDashboard,
      });

      return { dashboard, updatedDashboard };
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A dashboard with this name already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteDashboard = async (dashboardId: string, projectId: string): Promise<TDashboard> => {
  validateInputs([dashboardId, ZId], [projectId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const dashboard = await tx.dashboard.findFirst({
        where: { id: dashboardId, projectId },
        select: selectDashboard,
      });

      if (!dashboard) {
        throw new ResourceNotFoundError("Dashboard", dashboardId);
      }

      await tx.dashboard.delete({
        where: { id: dashboardId },
      });

      return dashboard;
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDashboard = async (dashboardId: string, projectId: string) => {
  validateInputs([dashboardId, ZId], [projectId, ZId]);

  try {
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: dashboardId, projectId },
      include: {
        widgets: {
          orderBy: { order: "asc" },
          include: {
            chart: {
              select: selectChart,
            },
          },
        },
      },
    });

    if (!dashboard) {
      throw new ResourceNotFoundError("Dashboard", dashboardId);
    }

    return dashboard;
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDashboards = async (projectId: string): Promise<TDashboardWithCount[]> => {
  validateInputs([projectId, ZId]);

  try {
    return await prisma.dashboard.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        ...selectDashboard,
        _count: { select: { widgets: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const addChartToDashboard = async (data: TAddWidgetInput) => {
  validateInputs([data, ZAddWidgetInput]);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const [chart, dashboard] = await Promise.all([
          tx.chart.findFirst({ where: { id: data.chartId, projectId: data.projectId } }),
          tx.dashboard.findFirst({ where: { id: data.dashboardId, projectId: data.projectId } }),
        ]);

        if (!chart) {
          throw new ResourceNotFoundError("Chart", data.chartId);
        }
        if (!dashboard) {
          throw new ResourceNotFoundError("Dashboard", data.dashboardId);
        }

        const maxOrder = await tx.dashboardWidget.aggregate({
          where: { dashboardId: data.dashboardId },
          _max: { order: true },
        });

        return tx.dashboardWidget.create({
          data: {
            dashboardId: data.dashboardId,
            chartId: data.chartId,
            title: data.title,
            layout: data.layout,
            order: (maxOrder._max.order ?? -1) + 1,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("This chart is already on the dashboard");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
