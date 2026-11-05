import "server-only";
import type { TV3ChartResource } from "./resources";
import type { TChartResourceRow } from "./service";

/** A stored JSON column as the object the contract promises; anything else is served as empty. */
const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * The public chart: the Feedback Dataset is `datasetId` (its internal name, feedback directory, stays
 * internal), the chart query and display settings are passed through as stored, and the dashboards that
 * hold the chart are embedded so a caller knows what an edit or a delete affects.
 */
export const serializeV3Chart = (row: TChartResourceRow): TV3ChartResource => ({
  id: row.id,
  workspaceId: row.workspaceId,
  datasetId: row.feedbackDirectoryId,
  name: row.name,
  type: row.type,
  query: asObject(row.query),
  config: asObject(row.config),
  creator: row.creator ? { name: row.creator.name } : null,
  dashboards: row.widgets.map(({ dashboard }) => ({ id: dashboard.id, name: dashboard.name })),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
