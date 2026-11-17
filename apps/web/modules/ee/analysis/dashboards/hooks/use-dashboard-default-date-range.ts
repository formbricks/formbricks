"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TDateRangePreset } from "@/lib/date-ranges";
import {
  type TAppDashboard,
  getChartApiErrorMessage,
  isStaleDashboardError,
  replaceDashboard,
} from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import { toSavedWidgets } from "../lib/stale-save";

/**
 * An editor's default date range for a dashboard: the rolling preset everyone opens it with when the URL
 * names none. Saved the way locked filters are — a whole-dashboard write of the dashboard as last read,
 * refused if someone changed it meanwhile — so it never overwrites another editor's change.
 */
export const useDashboardDefaultDateRange = ({
  dashboard,
  beginWrite,
  endWrite,
}: Readonly<{ dashboard: TAppDashboard; beginWrite: () => void; endWrite: () => void }>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  /** Save `preset` as the default, or clear it with `null`. Resolves to whether it was saved. */
  const saveDefaultDateRange = useCallback(
    async (preset: TDateRangePreset | null): Promise<boolean> => {
      setIsSaving(true);
      beginWrite();
      try {
        const current =
          queryClient.getQueryData<TAppDashboard>(dashboardKeys.detail(dashboard.id)) ?? dashboard;
        const saved = await replaceDashboard(dashboard.id, {
          name: current.name,
          expectedUpdatedAt: current.updatedAt,
          widgets: toSavedWidgets(current.widgets),
          defaultDateRange: preset,
        });
        queryClient.setQueryData(dashboardKeys.detail(dashboard.id), saved);
        toast.success(
          preset
            ? t("workspace.analysis.dashboards.default_date_range_saved")
            : t("workspace.analysis.dashboards.default_date_range_removed")
        );
        return true;
      } catch (error) {
        if (isStaleDashboardError(error)) {
          await queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(dashboard.id) });
          toast.error(t("workspace.analysis.dashboards.default_date_range_stale"));
          return false;
        }
        toast.error(
          getChartApiErrorMessage(error, t("workspace.analysis.dashboards.default_date_range_failed"))
        );
        return false;
      } finally {
        endWrite();
        setIsSaving(false);
      }
    },
    [beginWrite, dashboard, endWrite, queryClient, t]
  );

  return { isSaving, saveDefaultDateRange };
};
