import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { getUser } from "@/lib/user/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TChart, TChartType } from "../../types/analysis";

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
