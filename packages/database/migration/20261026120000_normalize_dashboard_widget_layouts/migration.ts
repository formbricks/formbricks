import { logger } from "@formbricks/logger";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";
import {
  MAX_DASHBOARD_WIDGETS,
  MAX_WIDGETS_PER_WRITE,
  MAX_WIDGET_Y,
  type TStoredWidget,
  repairLayouts,
} from "./utils";

const DASHBOARD_BATCH_SIZE = 500;

type TTx = DataMigrationContext["tx"];

/** The widgets of a batch of dashboards, grouped by dashboard. */
const widgetsByDashboard = async (tx: TTx, dashboardIds: string[]): Promise<Map<string, TStoredWidget[]>> => {
  const widgets = await tx.$queryRaw<(TStoredWidget & { dashboardId: string })[]>`
    SELECT "id", "dashboardId", "layout", "order"
    FROM "DashboardWidget"
    WHERE "dashboardId" = ANY(${dashboardIds}::text[])
  `;
  const grouped = new Map<string, TStoredWidget[]>();
  for (const { dashboardId, ...widget } of widgets) {
    const group = grouped.get(dashboardId);
    if (group) group.push(widget);
    else grouped.set(dashboardId, [widget]);
  }
  return grouped;
};

/** Write one dashboard's repaired layouts; how many widgets changed, and whether any sit below the grid. */
const repairDashboard = async (
  tx: TTx,
  widgets: TStoredWidget[]
): Promise<{ repaired: number; belowGrid: boolean }> => {
  const changes = repairLayouts(widgets);
  for (const { id, layout } of changes) {
    await tx.$executeRaw`
      UPDATE "DashboardWidget"
      SET "layout" = ${JSON.stringify(layout)}::jsonb, "updated_at" = NOW()
      WHERE "id" = ${id}
    `;
  }
  return { repaired: changes.length, belowGrid: changes.some(({ layout }) => layout.y > MAX_WIDGET_Y) };
};

/** What the repair did, and the dashboards an operator may want to look at. */
const reportRepair = ({
  repairedWidgets,
  repairedDashboards,
  stillBelowGrid,
  full,
  tooLargeToSave,
}: {
  repairedWidgets: number;
  repairedDashboards: number;
  stillBelowGrid: string[];
  full: string[];
  tooLargeToSave: string[];
}): void => {
  logger.info(
    `Dashboard widget layout repair: ${repairedWidgets.toString()} widgets on ${repairedDashboards.toString()} dashboards`
  );
  const warnings: [string[], string][] = [
    // Only a dashboard with more stacked widgets than 1000 grid rows hold; it opens, but a save is refused.
    [stillBelowGrid, "some widgets sit below the grid's last row"],
    // Older versions had no widget cap. These still open and save; they take no more widgets.
    [full, `some dashboards hold more than ${MAX_DASHBOARD_WIDGETS.toString()} widgets and take no more`],
    [
      tooLargeToSave,
      `some dashboards hold more than ${MAX_WIDGETS_PER_WRITE.toString()} widgets; the editor cannot save them whole until widgets are removed`,
    ],
  ];
  for (const [dashboardIds, message] of warnings) {
    if (dashboardIds.length > 0) logger.warn({ dashboardIds }, `Dashboard widget layout repair: ${message}`);
  }
};

/**
 * Bring every stored widget layout within the rules the dashboard API now enforces, once.
 *
 * Before the dashboard API, widget layouts were written without checks: undo, duplicate placement and
 * the editor's layout save could all store an overlap or a height above the grid's limit. The editor
 * sends the stored layouts back on every save, and so does an API client that reads a dashboard and
 * writes it back, so such a dashboard could no longer be saved at all (400 for a bound, 422 for an
 * overlap). `repairLayouts` keeps each widget's column and size where it can and moves overlapping
 * widgets down, as the editor's grid does.
 *
 * Only widgets whose layout changes are written. `Dashboard.updatedAt` is left alone: the dashboard
 * reads the same, and moving it would make every open editor's next save stale. Idempotent: a second
 * run finds nothing to change, and an empty database is a no-op.
 */
export const normalizeDashboardWidgetLayouts: MigrationScript = {
  type: "data",
  id: "cvhil89vhoqr4j0swb7titg8",
  name: "20261026120000_normalize_dashboard_widget_layouts",
  run: async ({ tx }) => {
    let cursor = "";
    let repairedWidgets = 0;
    let repairedDashboards = 0;
    const stillBelowGrid: string[] = [];
    const full: string[] = [];
    const tooLargeToSave: string[] = [];

    for (;;) {
      const dashboards = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Dashboard" WHERE "id" > ${cursor} ORDER BY "id" LIMIT ${DASHBOARD_BATCH_SIZE}
      `;
      if (dashboards.length === 0) break;
      cursor = dashboards[dashboards.length - 1].id;

      const grouped = await widgetsByDashboard(
        tx,
        dashboards.map((dashboard) => dashboard.id)
      );
      for (const [dashboardId, widgets] of grouped) {
        if (widgets.length > MAX_WIDGETS_PER_WRITE) tooLargeToSave.push(dashboardId);
        else if (widgets.length > MAX_DASHBOARD_WIDGETS) full.push(dashboardId);
        const { repaired, belowGrid } = await repairDashboard(tx, widgets);
        if (repaired === 0) continue;
        repairedWidgets += repaired;
        repairedDashboards += 1;
        if (belowGrid) stillBelowGrid.push(dashboardId);
      }
    }

    reportRepair({ repairedWidgets, repairedDashboards, stillBelowGrid, full, tooLargeToSave });
  },
};
