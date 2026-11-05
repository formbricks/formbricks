"use client";

import { LockIcon, LockOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/**
 * An editor's lock in the toolbar. `lock`: lock the filters they have set, so everyone who opens the
 * dashboard sees it filtered. `unlock`: once there are none of their own left to lock, take every locked
 * filter off again.
 */
export const LockFiltersButton = ({
  mode,
  isSaving,
  onClick,
}: Readonly<{ mode: "lock" | "unlock"; isSaving: boolean; onClick: () => void }>) => {
  const { t } = useTranslation();
  const isLock = mode === "lock";
  return (
    <TooltipRenderer
      tooltipContent={
        isLock
          ? t("workspace.analysis.dashboards.lock_filters_tooltip")
          : t("workspace.analysis.dashboards.unlock_filters_tooltip")
      }>
      <Button type="button" variant="secondary" size="sm" loading={isSaving} onClick={onClick}>
        {isLock ? <LockIcon /> : <LockOpenIcon />}
        {isLock
          ? t("workspace.analysis.dashboards.lock_filters")
          : t("workspace.analysis.dashboards.unlock_filters")}
      </Button>
    </TooltipRenderer>
  );
};
