import "server-only";
import { logger } from "@formbricks/logger";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemForbidden, problemUnauthorized, successResponse } from "@/app/api/v3/lib/response";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import { getDatasetChartFields } from "@/modules/ee/analysis/lib/dataset-chart-fields";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { authorizeDashboardRead, refuseUnlessDashboardDatasetReadable } from "./chart-data-operations";
import type { TV3DashboardFilterFields } from "./resources";
import { getDashboardChartsRow } from "./service";

/** How many of a dashboard's Feedback Datasets have their keys read at once. */
const DATASET_KEYS_CONCURRENCY = 5;

/** The keys of several datasets, one field per member, in key order: a key in several datasets is one field. */
const mergeFields = (perDataset: ReadonlyArray<readonly TEmbeddedChartField[]>): TV3DashboardFilterFields => {
  const byName = new Map<string, TEmbeddedChartField>();
  for (const field of perDataset.flat()) if (!byName.has(field.name)) byName.set(field.name, field);
  return {
    fields: [...byName.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ name, key }) => ({ name, key, label: key })),
  };
};

/**
 * `GET /api/v3/dashboards/{dashboardId}/filter-fields` → 200 `{ data: { fields: [{ name, key, label }] } }`.
 *
 * The embedded-data fields a filter on this dashboard can use: the keys of the Feedback Datasets its charts
 * read, and of no other dataset. A dashboard-bound read (ADR-0025), so a Dashboard viewer may make it: it is
 * how the dashboard's filter picker offers embedded-data keys to someone the field catalog
 * (`GET /api/v3/charts/fields`) refuses. A dataset the caller cannot read through the dashboard is left out
 * rather than failing the list, so its keys are never named to them; its charts refuse them anyway.
 *
 * Needs read access to the dashboard's workspace. Spends from the default v3 budget (the route wrapper).
 */
export async function listV3DashboardFilterFields({
  dashboardId,
  ...context
}: TV3ChartOperationContext & { dashboardId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const log = logger.withContext({ requestId, dashboardId });

  try {
    const row = await getDashboardChartsRow(dashboardId);
    // A dashboard that does not exist answers the same 403 as one the caller may not see.
    if (!row) return problemForbidden(requestId, undefined, instance);
    const access = await authorizeDashboardRead(row, context);
    if (access instanceof Response) return access;

    const actor = getV3AuthorizationActor(context.authentication);
    if (!actor) return problemUnauthorized(requestId, "Not authenticated", instance);

    const datasetIds = [...new Set(row.widgets.map(({ chart }) => chart.feedbackDirectoryId))];
    const perDataset = await mapWithConcurrency(datasetIds, DATASET_KEYS_CONCURRENCY, async (datasetId) => {
      const refused = await refuseUnlessDashboardDatasetReadable(access, datasetId, row, context);
      if (refused) return [];
      const { embeddedFields } = await getDatasetChartFields({
        datasetId,
        workspaceId: access.workspaceId,
        organizationId: access.organizationId,
        actor,
      });
      return embeddedFields;
    });

    return successResponse(mergeFields(perDataset), { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "dashboards.filterFields" });
  }
}
