"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DashboardDateFilter } from "@/modules/ee/analysis/dashboards/components/dashboard-date-filter";
import { LockFiltersButton } from "@/modules/ee/analysis/dashboards/components/lock-filters-button";
import type { useDashboardToolbarFilters } from "@/modules/ee/analysis/dashboards/hooks/use-dashboard-toolbar-filters";
import type { useLockedDashboardFilters } from "@/modules/ee/analysis/dashboards/hooks/use-locked-dashboard-filters";
import type { TDashboardDateFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-date-filter";
import type { TAppDashboard } from "@/modules/ee/analysis/lib/api-client";
import { TableToolbar } from "@/modules/ui/components/table-toolbar";

/**
 * The same table toolbar the responses page has: the filters an editor locked for everyone first, then a
 * Dashboard Viewer's own access conditions (locked for them), then this person's own filters, with the date
 * range — always this person's own — beside the Filter button.
 */
export function DashboardFilterToolbar({
  toolbar,
  lockedFilters,
  viewerAccess,
  dateFilter,
  onDateFilterChange,
}: Readonly<{
  toolbar: ReturnType<typeof useDashboardToolbarFilters>;
  lockedFilters: ReturnType<typeof useLockedDashboardFilters>;
  viewerAccess: TAppDashboard["viewerAccess"];
  dateFilter: TDashboardDateFilter | null;
  onDateFilterChange: (filter: TDashboardDateFilter | null) => void;
}>) {
  const { t } = useTranslation();

  // A Dashboard Viewer's data access (ENG-7372, ENG-7478): their conditions as chips locked for them.
  const toolbarLocked = useMemo(() => {
    const forYou = (viewerAccess?.chips ?? []).map((chip) => ({
      label: chip.label,
      value: chip.values.length > 0 ? chip.values.join(", ") : "—",
      hint: t("workspace.analysis.dashboards.locked_for_you_hint", { attribute: chip.attributeLabel }),
    }));
    if (forYou.length === 0) return lockedFilters.locked;
    return { ...(lockedFilters.locked ?? { filters: [], hint: "" }), forYou };
  }, [viewerAccess?.chips, lockedFilters.locked, t]);

  return (
    <TableToolbar
      filter={{
        properties: toolbar.properties,
        filters: toolbar.filters,
        onFiltersChange: toolbar.setFilters,
        locked: toolbarLocked,
        simpleRules: true,
      }}
      controls={<DashboardDateFilter value={dateFilter} onChange={onDateFilterChange} />}
      actions={
        <>
          {lockedFilters.canLock && (
            <LockFiltersButton
              mode="lock"
              isSaving={lockedFilters.isSaving}
              onClick={() => void lockedFilters.lockPersonalFilters()}
            />
          )}
          {lockedFilters.canUnlockAll && (
            <LockFiltersButton
              mode="unlock"
              isSaving={lockedFilters.isSaving}
              onClick={() => void lockedFilters.unlockAllFilters()}
            />
          )}
        </>
      }
    />
  );
}
