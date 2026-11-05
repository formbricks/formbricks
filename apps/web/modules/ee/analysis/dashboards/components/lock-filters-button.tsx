"use client";

import { LockIcon, LockOpenIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/**
 * An editor's lock in the toolbar. `lock`: lock the filters they have set, so everyone who opens the
 * dashboard sees it filtered. `unlock`: once there are none of their own left to lock, take every locked
 * filter off again — asked first, since it changes the dashboard for everyone; cancelling leaves them on.
 */
export const LockFiltersButton = ({
  mode,
  isSaving,
  onClick,
}: Readonly<{ mode: "lock" | "unlock"; isSaving: boolean; onClick: () => void }>) => {
  const { t } = useTranslation();
  const [isConfirmingUnlock, setIsConfirmingUnlock] = useState(false);
  const isLock = mode === "lock";
  return (
    <>
      <TooltipRenderer
        tooltipContent={
          isLock
            ? t("workspace.analysis.dashboards.lock_filters_tooltip")
            : t("workspace.analysis.dashboards.unlock_filters_tooltip")
        }>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={isSaving}
          onClick={isLock ? onClick : () => setIsConfirmingUnlock(true)}>
          {isLock ? <LockIcon /> : <LockOpenIcon />}
          {isLock
            ? t("workspace.analysis.dashboards.lock_filters")
            : t("workspace.analysis.dashboards.unlock_filters")}
        </Button>
      </TooltipRenderer>
      {!isLock && (
        <ConfirmationModal
          open={isConfirmingUnlock}
          setOpen={setIsConfirmingUnlock}
          title={t("workspace.analysis.dashboards.unlock_filters_confirm_title")}
          // Said in the description, which otherwise reads "cannot be undone": an unlock can be undone.
          description={t("workspace.analysis.dashboards.unlock_filters_confirm_body")}
          body={null}
          buttonText={t("workspace.analysis.dashboards.unlock_filters")}
          buttonVariant="destructive"
          onConfirm={() => {
            setIsConfirmingUnlock(false);
            onClick();
          }}
        />
      )}
    </>
  );
};
