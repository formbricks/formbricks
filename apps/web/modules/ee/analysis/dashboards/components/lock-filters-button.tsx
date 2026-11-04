"use client";

import { LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/** An editor's way to lock the filters they have set, so everyone who opens the dashboard sees it filtered. */
export const LockFiltersButton = ({
  isSaving,
  onLock,
}: Readonly<{ isSaving: boolean; onLock: () => void }>) => {
  const { t } = useTranslation();
  return (
    <TooltipRenderer tooltipContent={t("workspace.analysis.dashboards.lock_filters_tooltip")}>
      <Button type="button" variant="secondary" size="sm" loading={isSaving} onClick={onLock}>
        <LockIcon />
        {t("workspace.analysis.dashboards.lock_filters")}
      </Button>
    </TooltipRenderer>
  );
};
