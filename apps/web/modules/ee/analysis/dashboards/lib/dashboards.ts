import "server-only";
import { prisma } from "@formbricks/database";
import { TWidgetLayout } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import { selectChart } from "@/modules/ee/analysis/charts/lib/charts";
import {
  TAddWidgetInput,
  TChartType,
  TDashboard,
  TDashboardCreateInput,
  TDashboardUpdateInput,
  TDashboardWithCount,
  ZAddWidgetInput,
  ZDashboardCreateInput,
  ZDashboardUpdateInput,
} from "@/modules/ee/analysis/types/analysis";
import { findNextOpenSlot, parseWidgetLayouts } from "./widget-placement";

const MAX_NAME_ATTEMPTS = 5;

const getDefaultWidgetLayout = (chartType: TChartType): TWidgetLayout =>
  chartType === "big_number" ? { x: 0, y: 0, w: 3, h: 2 } : { x: 0, y: 0, w: 4, h: 4 };

/**
 * The `x`/`y` a new widget takes on a dashboard that already holds `existingWidgets`.
 *
 * "nextOpenSlot" fills the first gap the widget fits in, so a duplicate lands beside its original
 * instead of on top of it. The default keeps the requested `x` and starts the row below every
 * existing widget.
 */
const resolveWidgetPosition = (
  existingWidgets: { layout: unknown }[],
  baseLayout: TWidgetLayout,
  placement: TAddWidgetInput["placement"]
): Pick<TWidgetLayout, "x" | "y"> => {
  const layouts = parseWidgetLayouts(existingWidgets);

  if (placement === "nextOpenSlot") {
    return findNextOpenSlot(layouts, baseLayout);
  }

  return {
    x: baseLayout.x,
    y: layouts.reduce((max, layout) => Math.max(max, layout.y + layout.h), 0),
  };
};

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
        workspaceId: data.workspaceId,
        createdBy: data.createdBy,
      },
      select: selectDashboard,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("A dashboard with this name already exists");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateDashboard = async (
  dashboardId: string,
  workspaceId: string,
  data: TDashboardUpdateInput
): Promise<{ dashboard: TDashboard; updatedDashboard: TDashboard }> => {
  validateInputs([dashboardId, ZId], [workspaceId, ZId], [data, ZDashboardUpdateInput]);

  try {
    return await prisma.$transaction(async (tx) => {
      const dashboard = await tx.dashboard.findFirst({
        where: { id: dashboardId, workspaceId },
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
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("A dashboard with this name already exists");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteDashboard = async (dashboardId: string, workspaceId: string): Promise<TDashboard> => {
  validateInputs([dashboardId, ZId], [workspaceId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const dashboard = await tx.dashboard.findFirst({
        where: { id: dashboardId, workspaceId },
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
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDashboard = async (dashboardId: string, workspaceId: string) => {
  validateInputs([dashboardId, ZId], [workspaceId, ZId]);

  try {
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: dashboardId, workspaceId },
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
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDashboards = async (
  workspaceId: string,
  chartId?: string
): Promise<TDashboardWithCount[]> => {
  validateInputs([workspaceId, ZId], [chartId, ZId.optional()]);

  try {
    const select = {
      ...selectDashboard,
      creator: { select: { name: true } },
      _count: { select: { widgets: true } },
      ...(chartId ? { widgets: { where: { chartId }, select: { id: true }, take: 1 } } : {}),
    };

    const dashboards = await prisma.dashboard.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select,
    });

    if (!chartId) {
      return dashboards;
    }

    return dashboards.map(({ widgets, ...rest }) => ({
      ...rest,
      containsChart: (widgets?.length ?? 0) > 0,
    }));
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const duplicateDashboard = async (
  dashboardId: string,
  workspaceId: string,
  createdBy: string
): Promise<TDashboard> => {
  validateInputs([dashboardId, ZId], [workspaceId, ZId], [createdBy, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const source = await tx.dashboard.findFirst({
        where: { id: dashboardId, workspaceId },
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

      while (await tx.dashboard.findFirst({ where: { workspaceId, name } })) {
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
          workspaceId,
          createdBy,
          widgets: {
            create: source.widgets.map((widget) => ({
              chartId: widget.chartId,
              layout: widget.layout ?? { x: 0, y: 0, w: 4, h: 4 },
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
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateWidgetLayouts = async (
  dashboardId: string,
  workspaceId: string,
  widgets: { id: string; layout: TWidgetLayout; order: number }[]
): Promise<{ widgetCount: number }> => {
  validateInputs([dashboardId, ZId], [workspaceId, ZId]);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const dashboard = await tx.dashboard.findFirst({
          where: { id: dashboardId, workspaceId },
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

        const removedWidgetIds = dashboard.widgets
          .filter((w) => !updatedWidgetIds.has(w.id))
          .map((w) => w.id);

        await Promise.all([
          ...widgets.map((widget) =>
            tx.dashboardWidget.update({
              where: { id: widget.id },
              data: {
                layout: widget.layout,
                order: widget.order,
              },
            })
          ),
          ...(removedWidgetIds.length > 0
            ? [tx.dashboardWidget.deleteMany({ where: { id: { in: removedWidgetIds } } })]
            : []),
        ]);

        return { widgetCount: widgets.length };
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundError || error instanceof InvalidInputError) {
      throw error;
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const removeWidgetFromDashboard = async (
  dashboardId: string,
  workspaceId: string,
  widgetId: string
) => {
  validateInputs([dashboardId, ZId], [workspaceId, ZId], [widgetId, ZId]);

  try {
    const widget = await prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboard: { id: dashboardId, workspaceId } },
    });

    if (!widget) {
      throw new ResourceNotFoundError("DashboardWidget", widgetId);
    }

    return await prisma.dashboardWidget.delete({ where: { id: widgetId } });
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
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
          tx.chart.findFirst({ where: { id: data.chartId, workspaceId: data.workspaceId } }),
          tx.dashboard.findFirst({ where: { id: data.dashboardId, workspaceId: data.workspaceId } }),
        ]);

        if (!chart) {
          throw new ResourceNotFoundError("Chart", data.chartId);
        }
        if (!dashboard) {
          throw new ResourceNotFoundError("Dashboard", data.dashboardId);
        }

        const existingWidget = await tx.dashboardWidget.findFirst({
          where: {
            dashboardId: data.dashboardId,
            chartId: data.chartId,
          },
          select: { id: true },
        });

        if (existingWidget) {
          throw new InvalidInputError("This chart is already on the dashboard");
        }

        const [maxOrder, existingWidgets] = await Promise.all([
          tx.dashboardWidget.aggregate({
            where: { dashboardId: data.dashboardId },
            _max: { order: true },
          }),
          data.respectY
            ? Promise.resolve([])
            : tx.dashboardWidget.findMany({
                where: { dashboardId: data.dashboardId },
                select: { layout: true },
              }),
        ]);

        const baseLayout = data.layout ?? getDefaultWidgetLayout(chart.type as TChartType);
        // Positioned inside the transaction that creates the widget, off the layouts read within it:
        // two concurrent adds would otherwise pick the same spot from the same stale read.
        const layout = data.respectY
          ? baseLayout
          : { ...baseLayout, ...resolveWidgetPosition(existingWidgets, baseLayout, data.placement) };

        return tx.dashboardWidget.create({
          data: {
            dashboardId: data.dashboardId,
            chartId: data.chartId,
            layout,
            order: (maxOrder._max.order ?? -1) + 1,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundError || error instanceof InvalidInputError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("This chart is already on the dashboard");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
