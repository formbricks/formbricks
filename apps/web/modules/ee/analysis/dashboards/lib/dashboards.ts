import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TWidgetLayout } from "@formbricks/types/analysis";
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
} from "@/modules/ee/analysis/types/analysis";

const MAX_NAME_ATTEMPTS = 5;

const selectDashboard = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
} as const;

export const createDashboard = async (data: TDashboardCreateInput): Promise<TDashboard> => {
  validateInputs([data, ZDashboardCreateInput]);

  try {
    return await prisma.dashboard.create({
      data: {
        name: data.name,
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
        creator: { select: { name: true } },
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

export const duplicateDashboard = async (
  dashboardId: string,
  projectId: string,
  createdBy: string
): Promise<TDashboard> => {
  validateInputs([dashboardId, ZId], [projectId, ZId], [createdBy, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const source = await tx.dashboard.findFirst({
        where: { id: dashboardId, projectId },
        include: {
          widgets: { orderBy: { order: "asc" } },
        },
      });

      if (!source) {
        throw new ResourceNotFoundError("Dashboard", dashboardId);
      }

      const baseName = `${source.name} (copy)`;
      let name = baseName;
      let suffix = 1;

      while (await tx.dashboard.findFirst({ where: { projectId, name } })) {
        suffix++;
        if (suffix > MAX_NAME_ATTEMPTS) {
          name = `${baseName} ${suffix}`;
          break;
        }
        name = `${baseName} ${suffix}`;
      }

      const newDashboard = await tx.dashboard.create({
        data: {
          name,
          projectId,
          createdBy,
          widgets: {
            create: source.widgets.map((widget) => ({
              chartId: widget.chartId,
              title: widget.title,
              layout: widget.layout ?? { x: 0, y: 0, w: 4, h: 3 },
              order: widget.order,
            })),
          },
        },
        select: selectDashboard,
      });

      return newDashboard;
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

export const updateWidgetLayouts = async (
  dashboardId: string,
  projectId: string,
  widgets: { id: string; layout: TWidgetLayout; order: number }[]
): Promise<{ widgetCount: number }> => {
  validateInputs([dashboardId, ZId], [projectId, ZId]);

  try {
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: dashboardId, projectId },
      include: { widgets: { select: { id: true } } },
    });

    if (!dashboard) {
      throw new ResourceNotFoundError("Dashboard", dashboardId);
    }

    const existingWidgetIds = new Set(dashboard.widgets.map((w) => w.id));
    const updatedWidgetIds = new Set(widgets.map((w) => w.id));

    const invalidIds = widgets.filter((w) => !existingWidgetIds.has(w.id)).map((w) => w.id);
    if (invalidIds.length > 0) {
      throw new InvalidInputError(`Invalid widget IDs: ${invalidIds.join(", ")}`);
    }

    const removedWidgetIds = dashboard.widgets.filter((w) => !updatedWidgetIds.has(w.id)).map((w) => w.id);

    await prisma.$transaction([
      ...widgets.map((widget) =>
        prisma.dashboardWidget.update({
          where: { id: widget.id },
          data: {
            layout: widget.layout,
            order: widget.order,
          },
        })
      ),
      ...(removedWidgetIds.length > 0
        ? [prisma.dashboardWidget.deleteMany({ where: { id: { in: removedWidgetIds } } })]
        : []),
    ]);

    return { widgetCount: widgets.length };
  } catch (error) {
    if (error instanceof ResourceNotFoundError || error instanceof InvalidInputError) {
      throw error;
    }
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

        const [maxOrder, existingWidgets] = await Promise.all([
          tx.dashboardWidget.aggregate({
            where: { dashboardId: data.dashboardId },
            _max: { order: true },
          }),
          tx.dashboardWidget.findMany({
            where: { dashboardId: data.dashboardId },
            select: { layout: true },
          }),
        ]);

        const bottomY = existingWidgets.reduce((max, w) => {
          const layout = w.layout as { y: number; h: number };
          return Math.max(max, (layout.y ?? 0) + (layout.h ?? 0));
        }, 0);

        return tx.dashboardWidget.create({
          data: {
            dashboardId: data.dashboardId,
            chartId: data.chartId,
            title: data.title,
            layout: { ...data.layout, y: bottomY },
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
