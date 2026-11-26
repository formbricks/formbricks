import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Dashboard grid rows became a quarter as tall: a row was 80px, a unit is now 24px (8px rows, 16px apart), so
 * 4 units are what 1 row was. Widget layouts store `y` and `h` in rows, so every stored layout is multiplied
 * by 4 and a dashboard looks exactly as it did; `x` and `w` are columns and stay. A separator, which was a
 * whole 80px row for a hairline, becomes 2 units (32px).
 *
 * Runs once (a data migration is recorded when it has run, in the same transaction), as the multiplication
 * is not idempotent. Only layouts with whole `y` and `h` are touched. Every converted dashboard's `updatedAt`
 * moves too: an editor opened before the upgrade still holds layouts in the old rows, and its next save
 * (a whole-dashboard replace) must answer 409 rather than write them back over the converted ones. A no-op
 * on an empty database.
 */
export const scaleDashboardWidgetLayouts: MigrationScript = {
  type: "data",
  id: "c491ea1xpwrbov76wmbh1731",
  name: "20261124100000_scale_dashboard_widget_layouts",
  run: async ({ tx }) => {
    // One statement, so the dashboards moved are exactly those whose widgets were converted. An aggregate
    // SELECT, so it always returns one row.
    const [counts] = await tx.$queryRaw<{ widgets: bigint; dashboards: bigint }[]>`
      WITH converted AS (
        UPDATE "DashboardWidget"
        SET "layout" = "layout" || jsonb_build_object(
              'y', ("layout"->>'y')::int * 4,
              'h', CASE WHEN "kind" = 'separator' THEN 2 ELSE ("layout"->>'h')::int * 4 END
            ),
            "updated_at" = NOW() AT TIME ZONE 'UTC'
        WHERE ("layout"->>'y') ~ '^[0-9]+$' AND ("layout"->>'h') ~ '^[0-9]+$'
        RETURNING "dashboardId"
      ),
      moved AS (
        UPDATE "Dashboard"
        SET "updated_at" = GREATEST(NOW() AT TIME ZONE 'UTC', "updated_at" + INTERVAL '1 millisecond')
        WHERE "id" IN (SELECT "dashboardId" FROM converted)
        RETURNING "id"
      )
      SELECT (SELECT COUNT(*) FROM converted) AS widgets, (SELECT COUNT(*) FROM moved) AS dashboards
    `;
    console.log(
      `Dashboard grid scaled to finer rows: ${JSON.stringify({
        widgetsUpdated: Number(counts.widgets),
        dashboardsUpdated: Number(counts.dashboards),
      })}`
    );
  },
};
