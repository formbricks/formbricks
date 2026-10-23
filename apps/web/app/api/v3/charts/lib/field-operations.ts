import "server-only";
import { logger } from "@formbricks/logger";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemBadGateway,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { CubeQueryError, executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import {
  buildDimensionValueQuery,
  collectDimensionValues,
} from "@/modules/ee/analysis/lib/dimension-value-lookup";
import {
  CHART_DATE_PRESETS,
  CHART_FIELD_CATALOG,
  getChartField,
} from "@/modules/ee/analysis/lib/field-catalog";
import { applyChartQueryRateLimit } from "./data-operations";
import type { TV3ChartFieldCatalog } from "./resources";
import type { TV3ChartFieldValuesQuery } from "./schemas";

type TV3ReadContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/** The catalog never changes at runtime, so it is serialized once. */
const FIELD_CATALOG: TV3ChartFieldCatalog = {
  fields: CHART_FIELD_CATALOG.map((field) => ({
    ...field,
    filterOperators: [...field.filterOperators],
    granularities: [...field.granularities],
  })),
  datePresets: [...CHART_DATE_PRESETS],
};

/**
 * `GET /api/v3/charts/fields` → 200 `{ data: { fields, datePresets } }`.
 *
 * The same catalog for every Feedback Dataset today, but still answered per dataset: the caller has to be
 * able to read the dataset it is about to write a query for, and a future data source will have fields of
 * its own. Returns a `Response` and never throws — the MCP server calls it directly, with no wrapper.
 */
export async function getV3ChartFieldCatalog({
  workspaceId,
  datasetId,
  authentication,
  requestId,
  instance,
}: TV3ReadContext & { workspaceId: string; datasetId: string }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId, datasetId });

  try {
    const access = await requireDashboardsAccess(authentication, workspaceId, "read", requestId, instance);
    if (access instanceof Response) return access;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      authentication,
      access,
      datasetId,
      "read",
      requestId,
      instance
    );
    if (refused) return refused;

    return successResponse(FIELD_CATALOG, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.fields" });
  }
}

/**
 * Most distinct values a lookup returns. A pick-list, not an export: a field with more values is
 * narrowed server-side with `search`.
 */
export const FIELD_VALUE_LOOKUP_LIMIT = 100;

/**
 * `GET /api/v3/charts/fields/{field}/values` → 200 `{ data: [{ value, fieldType? }] }`.
 *
 * The stored values of a low-cardinality dimension, so a filter can use a value that really occurs —
 * an exact `equals` match then cannot miss on casing or spacing. Only catalog fields marked
 * `valueLookup` qualify: free-text dimensions are not a pick-list. Needs read access to the Feedback
 * Dataset, and spends from the chart-query budget, since it runs a query.
 */
export async function listV3ChartFieldValues({
  field,
  query,
  authentication,
  requestId,
  instance,
}: TV3ReadContext & { field: string; query: TV3ChartFieldValuesQuery }): Promise<Response> {
  const context = { authentication, requestId, instance };
  const log = logger.withContext({ requestId, workspaceId: query.workspaceId, datasetId: query.datasetId });

  try {
    const limited = await applyChartQueryRateLimit(context);
    if (limited) return limited;

    const access = await requireDashboardsAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      authentication,
      access,
      query.datasetId,
      "read",
      requestId,
      instance
    );
    if (refused) return refused;

    if (!getChartField(field)?.valueLookup) {
      return problemUnprocessableContent(requestId, "This field's values cannot be looked up", {
        instance,
        invalid_params: [
          {
            name: "field",
            reason:
              "Must be a field from the field catalog with valueLookup: true. Free-text fields are filtered with 'contains' instead.",
            code: "invalid_reference",
          },
        ],
      });
    }

    const actor = getV3AuthorizationActor(authentication);
    if (!actor) return problemUnauthorized(requestId, "Not authenticated", instance);

    const rows = await executeTenantScopedQuery({
      query: buildDimensionValueQuery({
        dimension: field,
        limit: FIELD_VALUE_LOOKUP_LIMIT,
        search: query.search,
      }),
      feedbackDirectoryId: query.datasetId,
      workspaceId: access.workspaceId,
      organizationId: access.organizationId,
      actor,
      source: "v3.charts.fieldValues",
    });

    return successResponse(collectDimensionValues(rows, field, FIELD_VALUE_LOOKUP_LIMIT), { requestId });
  } catch (error) {
    if (error instanceof CubeQueryError) {
      return problemBadGateway(
        requestId,
        error.timedOut
          ? "The value lookup took too long and was stopped."
          : "The values could not be looked up. Try again shortly.",
        instance
      );
    }
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.fieldValues" });
  }
}
