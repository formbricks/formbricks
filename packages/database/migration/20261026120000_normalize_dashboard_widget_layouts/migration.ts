import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import { MAX_WIDGET_Y, type TStoredWidget, repairLayouts } from "./utils";

const DASHBOARD_BATCH_SIZE = 500;

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
    const repairedDashboards: string[] = [];
    const stillBelowGrid: string[] = [];

    for (;;) {
      const dashboards = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Dashboard" WHERE "id" > ${cursor} ORDER BY "id" LIMIT ${DASHBOARD_BATCH_SIZE}
      `;
      if (dashboards.length === 0) break;
      cursor = dashboards[dashboards.length - 1].id;

      const widgets = await tx.$queryRaw<(TStoredWidget & { dashboardId: string })[]>`
        SELECT "id", "dashboardId", "layout", "order"
        FROM "DashboardWidget"
        WHERE "dashboardId" = ANY(${dashboards.map((dashboard) => dashboard.id)}::text[])
      `;

      const byDashboard = new Map<string, TStoredWidget[]>();
      for (const { dashboardId, ...widget } of widgets) {
        byDashboard.set(dashboardId, [...(byDashboard.get(dashboardId) ?? []), widget]);
      }

      for (const [dashboardId, dashboardWidgets] of byDashboard) {
        const changes = repairLayouts(dashboardWidgets);
        if (changes.length === 0) continue;
        for (const { id, layout } of changes) {
          await tx.$executeRaw`
            UPDATE "DashboardWidget"
            SET "layout" = ${JSON.stringify(layout)}::jsonb, "updated_at" = NOW()
            WHERE "id" = ${id}
          `;
        }
        repairedWidgets += changes.length;
        repairedDashboards.push(dashboardId);
        if (changes.some(({ layout }) => layout.y > MAX_WIDGET_Y)) stillBelowGrid.push(dashboardId);
      }
    }

    logger.info(
      `Dashboard widget layout repair: ${repairedWidgets.toString()} widgets on ${repairedDashboards.length.toString()} dashboards`
    );
    if (stillBelowGrid.length > 0) {
      // Only a dashboard with more stacked widgets than 1000 grid rows hold; it still opens, but a save
      // is refused until widgets are removed or resized.
      logger.warn(
        { dashboardIds: stillBelowGrid },
        "Dashboard widget layout repair: some widgets sit below the grid's last row"
      );
    }
  },
};
