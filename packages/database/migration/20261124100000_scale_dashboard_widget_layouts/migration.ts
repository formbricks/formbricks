import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Dashboard grid rows became a quarter as tall: a row was 80px, a unit is now 24px (8px rows, 16px apart), so
 * 4 units are what 1 row was. Widget layouts store `y` and `h` in rows, so every stored layout is multiplied
 * by 4 and a dashboard looks exactly as it did; `x` and `w` are columns and stay. A separator, which was a
 * whole 80px row for a hairline, becomes 2 units (32px).
 *
 * Runs once (a data migration is recorded when it has run), as the multiplication is not idempotent. Only
 * layouts with whole `y` and `h` are touched, and `Dashboard.updatedAt` is left alone: the dashboard reads
 * the same, and moving it would make every open editor's next save stale. A no-op on an empty database.
 */
export const scaleDashboardWidgetLayouts: MigrationScript = {
  type: "data",
  id: "c491ea1xpwrbov76wmbh1731",
  name: "20261124100000_scale_dashboard_widget_layouts",
  run: async ({ tx }) => {
    const updated = await tx.$executeRaw`
      UPDATE "DashboardWidget"
      SET "layout" = "layout" || jsonb_build_object(
            'y', ("layout"->>'y')::int * 4,
            'h', CASE WHEN "kind" = 'separator' THEN 2 ELSE ("layout"->>'h')::int * 4 END
          ),
          "updated_at" = NOW()
      WHERE ("layout"->>'y') ~ '^[0-9]+$' AND ("layout"->>'h') ~ '^[0-9]+$'
    `;
    console.log(
      `Dashboard grid scaled to finer rows: ${JSON.stringify({ widgetsUpdated: Number(updated) })}`
    );
  },
};
