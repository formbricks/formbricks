import "server-only";
import { getDashboardFilterField } from "./dashboard-filters";

/**
 * Whether a Feedback Dataset has a field a dashboard filter names. A filter matches a chart by field name in
 * the chart's dataset (ADR-0019); every dataset shares the field catalog today, so this asks the catalog.
 * Per-dataset fields (embedded data) answer here too once the catalog is per dataset, which is why the
 * dataset is asked for: every caller already passes it.
 */
export const getDatasetFieldMatcher = async (_datasetId: string): Promise<(field: string) => boolean> => {
  return (field) => getDashboardFilterField(field) !== undefined;
};
