import "server-only";
import { logger } from "@formbricks/logger";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { CHART_DATE_PRESETS, CHART_FIELD_CATALOG } from "@/modules/ee/analysis/lib/field-catalog";
import type { TV3ChartFieldCatalog } from "./resources";

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
