import "server-only";
import { prisma } from "@formbricks/database";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import type { TCubeQueryActor } from "@/modules/ee/analysis/api/lib/cube-config";
import {
  type TDashboardFilter,
  parseStoredDashboardFilters,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";

/**
 * The embedded-data filter fields of a dashboard write that no kept widget's Feedback Dataset has, each
 * named at its position. A `FeedbackRecords.ed_*` field passes the schema by its name pattern alone, so a
 * key nobody's charts read would otherwise be saved as a filter that can narrow nothing. A field already
 * saved on the dashboard is not asked again: a filter keeps saving after its key leaves every chart.
 */
export const findUnknownEmbeddedFilterFields = async ({
  dashboardId,
  filters,
  widgetIds,
  access,
  actor,
}: {
  dashboardId: string;
  filters: readonly TDashboardFilter[];
  widgetIds: readonly string[];
  access: V3WorkspaceContext;
  actor: TCubeQueryActor;
}): Promise<InvalidParam[]> => {
  const embedded = filters.flatMap((filter, index) =>
    isEmbeddedMemberName(filter.field) ? [{ field: filter.field, index }] : []
  );
  if (embedded.length === 0) return [];

  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: {
      filters: true,
      widgets: {
        where: { id: { in: [...widgetIds] } },
        select: { chart: { select: { feedbackDirectoryId: true } } },
      },
    },
  });
  const saved = new Set(parseStoredDashboardFilters(dashboard?.filters).map(({ field }) => field));
  const asked = embedded.filter(({ field }) => !saved.has(field));
  if (asked.length === 0) return [];

  const fields = [...new Set(asked.map(({ field }) => field))];
  const datasetIds = [...new Set((dashboard?.widgets ?? []).map(({ chart }) => chart.feedbackDirectoryId))];
  const matchers = await Promise.all(
    datasetIds.map((datasetId) =>
      getDatasetFieldMatcher(
        { datasetId, workspaceId: access.workspaceId, organizationId: access.organizationId, actor },
        fields
      )
    )
  );

  return asked
    .filter(({ field }) => !matchers.some((hasField) => hasField(field)))
    .map(({ index }) => ({
      name: `filters[${index}].field`,
      reason: "No chart on this dashboard reads a Feedback Dataset with this embedded-data key.",
      code: "invalid_reference" as const,
    }));
};
