-- Remove duplicate chart widgets before enforcing the dashboard/chart uniqueness invariant.
DELETE FROM "public"."DashboardWidget" widget
USING (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "dashboardId", "chartId"
            ORDER BY "order" ASC, "created_at" ASC, "id" ASC
        ) AS row_number
    FROM "public"."DashboardWidget"
) duplicate_widgets
WHERE widget."id" = duplicate_widgets."id"
  AND duplicate_widgets.row_number > 1;

-- CreateIndex
CREATE UNIQUE INDEX "DashboardWidget_dashboardId_chartId_key" ON "public"."DashboardWidget"("dashboardId", "chartId");
