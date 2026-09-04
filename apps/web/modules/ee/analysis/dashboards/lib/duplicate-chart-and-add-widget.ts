import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { TWidgetLayout, ZWidgetLayout } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { duplicateChart } from "@/modules/ee/analysis/charts/lib/charts";
import { addChartToDashboard } from "./dashboards";
import { findNextOpenSlot, parseWidgetLayouts } from "./widget-placement";

/**
 * Deep-copies a chart (new UUID, "(copy)" name suffix, copied query/config) and adds the
 * new chart as a widget on the given dashboard. The dashboard is verified first so a
 * missing dashboard does not leave an orphaned chart copy behind.
 *
 * When `layout` is given it is only used for the copy's size: the position comes from the first
 * gap on the dashboard, so the copy never lands on top of its original.
 */
export const duplicateChartAndAddWidget = async ({
  dashboardId,
  workspaceId,
  chartId,
  createdBy,
  layout,
}: {
  dashboardId: string;
  workspaceId: string;
  chartId: string;
  createdBy: string;
  layout?: TWidgetLayout;
}) => {
  validateInputs(
    [dashboardId, ZId],
    [workspaceId, ZId],
    [chartId, ZId],
    [createdBy, ZId],
    [layout, ZWidgetLayout.optional()]
  );

  let dashboard;
  try {
    dashboard = await prisma.dashboard.findFirst({
      where: { id: dashboardId, workspaceId },
      select: { id: true, widgets: { select: { layout: true } } },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  if (!dashboard) {
    throw new ResourceNotFoundError("Dashboard", dashboardId);
  }

  const placedLayout = layout
    ? { ...layout, ...findNextOpenSlot(parseWidgetLayouts(dashboard.widgets), layout) }
    : undefined;

  const chart = await duplicateChart(chartId, workspaceId, createdBy);
  const widget = await addChartToDashboard({
    dashboardId,
    chartId: chart.id,
    workspaceId,
    layout: placedLayout,
    // The slot above already accounts for every existing widget; without this the y would be
    // overwritten with the row below them all.
    respectY: placedLayout !== undefined,
  });

  return { chart, widget };
};
