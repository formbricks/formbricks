import "server-only";
import { MAX_DASHBOARD_WIDGETS } from "@/app/api/v3/dashboards/lib/schemas";
import { type InvalidParam, problemConflict, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import { isNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import type { TV3ChartOperationContext } from "./access";

/** The chart query validator's refusal: 422 naming every problem it found, in the query or its date range. */
export const refuseChartQuery = (
  invalidParams: InvalidParam[],
  { requestId, instance }: TV3ChartOperationContext,
  detail = "The chart query is not valid"
): Response =>
  problemUnprocessableContent(requestId, detail, {
    instance,
    invalid_params: invalidParams,
  });

/** 409 for a name another chart in the workspace already has; names are how people find charts. */
export const chartNameTaken = ({ requestId, instance }: TV3ChartOperationContext): Response =>
  problemConflict(requestId, "A chart with this name already exists in this workspace.", instance);

/** 409 for an add to a dashboard at the widget cap a whole-dashboard save carries. */
export const dashboardFull = ({ requestId, instance }: { requestId: string; instance?: string }): Response =>
  problemConflict(
    requestId,
    `This dashboard already holds ${MAX_DASHBOARD_WIDGETS} widgets, the most it can. Remove one first.`,
    instance
  );

/**
 * Matrix charts read data the 6.1 online upgrade migrates, so none may be created or switched to until
 * it has finished. Checked per request: activation only moves forward, and a running pod sees it from
 * the database without a redeploy.
 */
export const refuseMatrixUntilUpgraded = async (
  type: TChartType | undefined,
  { requestId, instance }: TV3ChartOperationContext
): Promise<Response | null> => {
  if (type !== "matrix" || (await isNewReleaseWorkEnabled())) return null;
  return problemUnprocessableContent(requestId, "Matrix charts are not available yet", {
    instance,
    invalid_params: [
      {
        name: "type",
        reason:
          "Matrix charts become available once this instance finishes its online upgrade to 6.1. Use another chart type until then.",
      },
    ],
  });
};
