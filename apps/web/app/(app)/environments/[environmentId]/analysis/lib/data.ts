"use server";

import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getUser } from "@/lib/user/service";
import { TDashboard, TChart } from "../types/analysis";

/**
 * Fetches all dashboards for the given environment
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

  // Fetch user names for createdBy fields
  const userIds = [...new Set(dashboards.map((d) => d.createdBy).filter(Boolean) as string[])];
  const users = await Promise.all(userIds.map((id) => getUser(id)));
  const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!.name]));

  // Transform to match TDashboard type
  return dashboards.map((dashboard) => {
    const chartCount = dashboard.widgets.filter((widget) => widget.type === "chart").length;
    const createdByName = dashboard.createdBy ? userMap.get(dashboard.createdBy) : undefined;

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description || undefined,
      status: dashboard.status,
      owners: [], // TODO: Fetch owners if needed
      lastModified: dashboard.updatedAt.toISOString(),
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
      createdBy: dashboard.createdBy || undefined,
      createdByName,
      chartCount,
      isFavorite: false, // TODO: Add favorite functionality if needed
      widgets: dashboard.widgets.map((widget) => ({
        id: widget.id,
        type: widget.type as "chart" | "markdown" | "header" | "divider",
        title: widget.title || undefined,
        chartId: widget.chartId || undefined,
        layout: widget.layout as { x: number; y: number; w: number; h: number },
      })),
    };
  });
});

/**
 * Fetches all charts for the given environment
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

  // Fetch user names for createdBy fields
  const userIds = [...new Set(charts.map((c) => c.createdBy).filter(Boolean) as string[])];
  const users = await Promise.all(userIds.map((id) => getUser(id)));
  const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!.name]));

  // Transform to match TChart type
  return charts.map((chart) => {
    const createdByName = chart.createdBy ? userMap.get(chart.createdBy) : undefined;

    return {
      id: chart.id,
      name: chart.name,
      type: chart.type as TChart["type"],
      dataset: "FeedbackRecords", // TODO: Make this dynamic if needed
      owners: [], // TODO: Fetch owners if needed
      lastModified: chart.updatedAt.toISOString(),
      createdAt: chart.createdAt.toISOString(),
      updatedAt: chart.updatedAt.toISOString(),
      createdBy: chart.createdBy || undefined,
      createdByName,
      dashboardIds: chart.widgets.map((widget) => widget.dashboardId),
      config: (chart.config as Record<string, any>) || {},
    };
  });
});

/**
 * Fetches a single dashboard by ID
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
      owners: [], // TODO: Fetch owners if needed
      lastModified: dashboard.updatedAt.toISOString(),
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
      createdBy: dashboard.createdBy || undefined,
      createdByName: undefined, // Will be fetched if needed
      chartCount,
      isFavorite: false, // TODO: Add favorite functionality if needed
      widgets: dashboard.widgets.map((widget) => ({
        id: widget.id,
        type: widget.type as "chart" | "markdown" | "header" | "divider",
        title: widget.title || undefined,
        chartId: widget.chartId || undefined,
        layout: widget.layout as { x: number; y: number; w: number; h: number },
        chart: widget.chart
          ? {
            id: widget.chart.id,
            name: widget.chart.name,
            type: widget.chart.type as TChart["type"],
            query: widget.chart.query as Record<string, any>,
            config: (widget.chart.config as Record<string, any>) || {},
          }
          : undefined,
      })),
    };
  }
);
