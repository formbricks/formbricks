import "server-only";
import type { TDashboardsAccessContext } from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import type { TDashboardChartsRow } from "./service";

/**
 * A Dashboard viewer sees a dashboard's data only as its charts show it (ADR-0025). An embedded-data key
 * can hold anything — an email, a free-text note — so a viewer may filter by, and list the values of, only
 * the keys some chart on the dashboard groups by: values the charts already show them. Every other key is
 * left out of their field list and refused when named. Locked filters are not affected: an editor chose
 * them, and they apply to every read whatever the key.
 */

/** The embedded-data fields some chart on the dashboard groups by. */
export const getGroupedEmbeddedFields = (widgets: TDashboardChartsRow["widgets"]): ReadonlySet<string> => {
  const fields = new Set<string>();
  for (const { chart } of widgets) {
    const dimensions = (chart.query as { dimensions?: unknown } | null)?.dimensions;
    if (!Array.isArray(dimensions)) continue;
    for (const dimension of dimensions) {
      if (typeof dimension === "string" && isEmbeddedMemberName(dimension)) fields.add(dimension);
    }
  }
  return fields;
};

/** Whether the caller may filter by `field` on this dashboard: anyone but a viewer, any field but an ungrouped key. */
export const mayFilterBy = (
  access: TDashboardsAccessContext,
  field: string,
  grouped: ReadonlySet<string>
): boolean => !access.asDashboardViewer || !isEmbeddedMemberName(field) || grouped.has(field);

/**
 * The 403 for a Dashboard viewer naming an embedded-data key no chart on the dashboard groups by, or `null`
 * when every named field is one they may filter by.
 */
export const refuseUngroupedFieldsForViewer = (
  access: TDashboardsAccessContext,
  fields: readonly string[],
  widgets: TDashboardChartsRow["widgets"],
  { requestId, instance }: { requestId: string; instance?: string }
): Response | null => {
  if (!access.asDashboardViewer || !fields.some(isEmbeddedMemberName)) return null;
  const grouped = getGroupedEmbeddedFields(widgets);
  return fields.every((field) => mayFilterBy(access, field, grouped))
    ? null
    : problemForbidden(
        requestId,
        "A Dashboard viewer can filter only by embedded data the dashboard's charts group by.",
        instance
      );
};
