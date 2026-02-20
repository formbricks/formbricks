import "server-only";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { TWidgetLayout } from "@formbricks/types/dashboard";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { selectChart } from "@/modules/ee/analysis/charts/lib/charts";

const selectDashboard = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const createDashboard = async (data: {
  projectId: string;
  name: string;
  description?: string;
  createdBy: string;
}) => {
  validateInputs([data.projectId, ZId], [data.createdBy, ZId]);

  return prisma.dashboard.create({
    data: {
      name: data.name,
      description: data.description,
      projectId: data.projectId,
      createdBy: data.createdBy,
    },
  });
};

export const updateDashboard = async (
  dashboardId: string,
  projectId: string,
  data: {
    name?: string;
    description?: string | null;
  }
) => {
  validateInputs([dashboardId, ZId], [projectId, ZId]);

  return prisma.$transaction(async (tx) => {
    const dashboard = await tx.dashboard.findFirst({
      where: { id: dashboardId, projectId },
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
    });

    return { dashboard, updatedDashboard };
  });
};

export const deleteDashboard = async (dashboardId: string, projectId: string) => {
  validateInputs([dashboardId, ZId], [projectId, ZId]);

  return prisma.$transaction(async (tx) => {
    const dashboard = await tx.dashboard.findFirst({
      where: { id: dashboardId, projectId },
    });

    if (!dashboard) {
      throw new ResourceNotFoundError("Dashboard", dashboardId);
    }

    await tx.dashboard.delete({
      where: { id: dashboardId },
    });

    return dashboard;
  });
};

export const getDashboard = async (dashboardId: string, projectId: string) => {
  validateInputs([dashboardId, ZId], [projectId, ZId]);

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
};

export const getDashboards = async (projectId: string) => {
  validateInputs([projectId, ZId]);

  return prisma.dashboard.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      ...selectDashboard,
      _count: { select: { widgets: true } },
    },
  });
};

export const addChartToDashboard = async (data: {
  dashboardId: string;
  chartId: string;
  projectId: string;
  title?: string;
  layout: TWidgetLayout;
}) => {
  validateInputs([data.dashboardId, ZId], [data.chartId, ZId], [data.projectId, ZId]);

  return prisma.$transaction(
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
};
