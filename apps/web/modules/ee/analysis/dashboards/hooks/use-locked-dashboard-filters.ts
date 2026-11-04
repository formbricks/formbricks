"use client";

import { createId } from "@paralleldrive/cuid2";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  type TAppDashboard,
  getChartApiErrorMessage,
  isStaleDashboardError,
  replaceDashboard,
} from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type { TLockedFilters } from "@/modules/ui/components/table-toolbar";
import type { TDashboardFilterState } from "../lib/dashboard-filter-state";
import {
  MAX_DASHBOARD_FILTERS,
  MAX_DASHBOARD_FILTER_LABEL_LENGTH,
  type TLockedDashboardFilter,
} from "../lib/dashboard-filters";
import { toStatedFilters, toToolbarFilters } from "../lib/dashboard-toolbar-filters";
import { toSavedWidgets } from "../lib/stale-save";

const sameFilter = (a: TDashboardFilterState, b: TDashboardFilterState): boolean =>
  a.field === b.field && a.operator === b.operator && a.values.join("\u0000") === b.values.join("\u0000");

/**
 * The filters an editor locks on a dashboard (ADR-0026): saved on it with their values, applied by the
 * server to every read whoever reads it, and shown locked before each person's own. An editor locks the
 * filters they have set, which then leave their own; a locked one comes off only by an editor's unlock.
 */
export const useLockedDashboardFilters = ({
  dashboard,
  personalFilters,
  fieldLabel,
  onPersonalFiltersChange,
  canEdit,
  beginWrite,
  endWrite,
}: Readonly<{
  dashboard: TAppDashboard;
  personalFilters: readonly TDashboardFilterState[];
  fieldLabel: (field: string) => string;
  onPersonalFiltersChange: (filters: TDashboardFilterState[]) => void;
  canEdit: boolean;
  beginWrite: () => void;
  endWrite: () => void;
}>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(
    async (next: TLockedDashboardFilter[], success: string): Promise<boolean> => {
      setIsSaving(true);
      beginWrite();
      try {
        // A whole-dashboard write that keeps the name and widgets as they are and replaces the filters.
        const saved = await replaceDashboard(dashboard.id, {
          name: dashboard.name,
          expectedUpdatedAt: dashboard.updatedAt,
          widgets: toSavedWidgets(dashboard.widgets),
          filters: next,
        });
        queryClient.setQueryData(dashboardKeys.detail(dashboard.id), saved);
        await queryClient.invalidateQueries({ queryKey: chartKeys.allData() });
        toast.success(success);
        return true;
      } catch (error) {
        if (isStaleDashboardError(error)) {
          // Someone changed the dashboard meanwhile: read it again so the next try starts from theirs.
          await queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(dashboard.id) });
          toast.error(t("workspace.analysis.dashboards.locked_filters_stale"));
          return false;
        }
        toast.error(getChartApiErrorMessage(error, t("workspace.analysis.dashboards.locked_filters_failed")));
        return false;
      } finally {
        endWrite();
        setIsSaving(false);
      }
    },
    [beginWrite, dashboard, endWrite, queryClient, t]
  );

  /** Lock the person's own filters for everyone: they join the locked ones and leave the person's own. */
  const lockPersonalFilters = useCallback(async () => {
    const locked = toStatedFilters(dashboard.filters);
    const added = personalFilters.filter(
      (filter, index) =>
        !locked.some((current) => sameFilter(current, filter)) &&
        personalFilters.findIndex((other) => sameFilter(other, filter)) === index
    );
    if (dashboard.filters.length + added.length > MAX_DASHBOARD_FILTERS) {
      toast.error(t("workspace.analysis.dashboards.filter_limit_reached", { max: MAX_DASHBOARD_FILTERS }));
      return;
    }
    const next: TLockedDashboardFilter[] = [
      ...dashboard.filters,
      ...added.map((filter) => ({
        id: createId(),
        field: filter.field,
        operator: filter.operator,
        label: fieldLabel(filter.field).slice(0, MAX_DASHBOARD_FILTER_LABEL_LENGTH),
        values: [...filter.values],
      })),
    ];
    if (await save(next, t("workspace.analysis.dashboards.filters_locked"))) onPersonalFiltersChange([]);
  }, [dashboard.filters, fieldLabel, onPersonalFiltersChange, personalFilters, save, t]);

  // The toolbar shows only the locked filters it can name; each keeps its place in the saved list.
  const shown = useMemo(
    () =>
      dashboard.filters.flatMap((filter, index) =>
        toToolbarFilters(toStatedFilters([filter])).map((toolbarFilter) => ({ toolbarFilter, index }))
      ),
    [dashboard.filters]
  );

  const locked: TLockedFilters = {
    filters: shown.map(({ toolbarFilter }) => toolbarFilter),
    labels: shown.map(({ index }) => dashboard.filters[index]?.label ?? ""),
    hint: canEdit
      ? t("workspace.analysis.dashboards.locked_filter_hint_editor")
      : t("workspace.analysis.dashboards.locked_filter_hint"),
    onRemove: canEdit
      ? (shownIndex) => {
          const source = shown[shownIndex];
          if (!source || isSaving) return;
          void save(
            dashboard.filters.filter((_, index) => index !== source.index),
            t("workspace.analysis.dashboards.filter_unlocked")
          );
        }
      : undefined,
  };

  return {
    locked,
    canLock: canEdit && personalFilters.length > 0,
    lockPersonalFilters,
    isSaving,
  };
};
