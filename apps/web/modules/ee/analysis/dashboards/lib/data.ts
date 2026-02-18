import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { executeQuery } from "@/app/api/analytics/_lib/cube-client";
import { getUser } from "@/lib/user/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TChart, TChartConfig, TChartType, TCubeQuery, TDashboard, TWidgetType } from "../types/analysis";

/**
 * Fetches all dashboards for the given environment.
 */
export const getDashboards = reactCache(async (environmentId: string): Promise<TDashboard[]> => {
  const { project } = await getEnvironmentAuth(environmentId);

  const dashboards = await prisma.dashboard.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      widgets: {
        select: {
          id: true,
          type: true,
          title: true,
          chartId: true,
          layout: true,
        },
      },
    },
  });

  const userIds = [...new Set(dashboards.map((d) => d.createdBy).filter(Boolean) as string[])];
  const users = await Promise.all(userIds.map((id) => getUser(id)));
  const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!.name]));

  return dashboards.map((dashboard) => {
    const chartCount = dashboard.widgets.filter((widget) => widget.type === "chart").length;
    const createdByName = dashboard.createdBy ? userMap.get(dashboard.createdBy) : undefined;

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description || undefined,
      status: dashboard.status,
      lastModified: dashboard.updatedAt.toISOString(),
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
      createdBy: dashboard.createdBy || undefined,
      createdByName,
      chartCount,
      widgets: dashboard.widgets.map((widget) => ({
        id: widget.id,
        type: widget.type as TWidgetType,
        title: widget.title || undefined,
        chartId: widget.chartId || undefined,
        layout: widget.layout as { x: number; y: number; w: number; h: number },
      })),
    };
  });
});

/**
 * Fetches all charts for the given environment.
 */
export const getCharts = reactCache(async (environmentId: string): Promise<TChart[]> => {
  const { project } = await getEnvironmentAuth(environmentId);

  const charts = await prisma.chart.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      widgets: {
        select: {
          dashboardId: true,
        },
      },
    },
  });

  const userIds = [...new Set(charts.map((c) => c.createdBy).filter(Boolean) as string[])];
  const users = await Promise.all(userIds.map((id) => getUser(id)));
  const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!.name]));

  return charts.map((chart) => {
    const createdByName = chart.createdBy ? userMap.get(chart.createdBy) : undefined;

    return {
      id: chart.id,
      name: chart.name,
      type: chart.type as TChartType,
      lastModified: chart.updatedAt.toISOString(),
      createdAt: chart.createdAt.toISOString(),
      updatedAt: chart.updatedAt.toISOString(),
      createdBy: chart.createdBy || undefined,
      createdByName,
      dashboardIds: chart.widgets.map((widget) => widget.dashboardId),
      config: (chart.config as Record<string, unknown>) || {},
    };
  });
});

/**
 * Executes a Cube.js query server-side and returns the result rows.
 * Intended to be called from server components so data is fetched on
 * the server rather than via client-side useEffect waterfalls.
 */
export async function executeWidgetQuery(
  query: TCubeQuery
): Promise<{ data: Record<string, unknown>[] } | { error: string }> {
  try {
    const data = await executeQuery(query as Record<string, unknown>);
    return { data: Array.isArray(data) ? data : [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute query";
    return { error: message };
  }
}

/**
 * Fetches a single dashboard by ID.
 */
export const getDashboard = reactCache(
  async (environmentId: string, dashboardId: string): Promise<TDashboard | null> => {
    const { project } = await getEnvironmentAuth(environmentId);

    const dashboard = await prisma.dashboard.findFirst({
      where: {
        id: dashboardId,
        projectId: project.id,
      },
      include: {
        widgets: {
          include: {
            chart: {
              select: {
                id: true,
                name: true,
                type: true,
                query: true,
                config: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!dashboard) {
      return null;
    }

    const chartCount = dashboard.widgets.filter((widget) => widget.type === "chart").length;

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description || undefined,
      status: dashboard.status,
      lastModified: dashboard.updatedAt.toISOString(),
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
      createdBy: dashboard.createdBy || undefined,
      createdByName: undefined,
      chartCount,
      widgets: dashboard.widgets.map((widget) => ({
        id: widget.id,
        type: widget.type as TWidgetType,
        title: widget.title || undefined,
        chartId: widget.chartId || undefined,
        layout: widget.layout as { x: number; y: number; w: number; h: number },
        chart: widget.chart
          ? {
              id: widget.chart.id,
              name: widget.chart.name,
              type: widget.chart.type as TChartType,
              query: widget.chart.query as unknown as TCubeQuery,
              config: ((widget.chart.config as TChartConfig) || {}) as TChartConfig,
            }
          : undefined,
      })),
    };
  }
);
