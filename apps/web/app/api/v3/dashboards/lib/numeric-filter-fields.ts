import "server-only";
import { problemUnprocessableContent } from "@/app/api/v3/lib/response";
import { filterRuleParamName } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-rules";
import {
  type TDashboardFilter,
  findNonNumericComparisonIssues,
  isEmbeddedComparisonFilter,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getNumericEmbeddedFields } from "@/modules/ee/analysis/dashboards/lib/embedded-field-types";

/**
 * The 422 for a read's own filters that compare an embedded-data key with a number (`gt`, `gte`, `lt`,
 * `lte`) where the key is not a number on this dashboard, naming each `filter[<id>]`; `null` otherwise.
 * The dashboard's numeric keys are read only when a filter compares one, from every Feedback Dataset its
 * charts read (`datasetIds`, loaded then), so a key has the one type on every chart of the dashboard.
 */
export const refuseNonNumericComparisons = async (
  filters: readonly TDashboardFilter[],
  {
    workspaceId,
    datasetIds,
    requestId,
    instance,
  }: {
    workspaceId: string;
    datasetIds: () => Promise<readonly string[]>;
    requestId: string;
    instance?: string;
  }
): Promise<Response | null> => {
  if (!filters.some(isEmbeddedComparisonFilter)) return null;
  const numeric = await getNumericEmbeddedFields(workspaceId, await datasetIds());
  const issues = findNonNumericComparisonIssues(filters, numeric).flatMap(({ path, message }) => {
    const filter = typeof path[0] === "number" ? filters[path[0]] : undefined;
    return filter ? [{ name: filterRuleParamName(filter.id), reason: message }] : [];
  });
  return issues.length === 0
    ? null
    : problemUnprocessableContent(requestId, "The filters are not valid", {
        instance,
        invalid_params: issues,
      });
};
