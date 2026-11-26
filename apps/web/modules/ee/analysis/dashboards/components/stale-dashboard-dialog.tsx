"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface StaleDashboardDialogProps {
  open: boolean;
  /** Names of the pages, charts and blocks the overwrite would take off the dashboard. */
  removedItemNames: string[];
  isSaving: boolean;
  onReload: () => void;
  onSaveAnyway: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Shown when a save was refused because someone else changed the dashboard during the edit. */
export const StaleDashboardDialog = ({
  open,
  removedItemNames,
  isSaving,
  onReload,
  onSaveAnyway,
  onOpenChange,
}: Readonly<StaleDashboardDialogProps>) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-y-2">
          <DialogTitle>{t("workspace.analysis.dashboards.stale_title")}</DialogTitle>
          <DialogDescription>{t("workspace.analysis.dashboards.stale_description")}</DialogDescription>
        </DialogHeader>
        {removedItemNames.length > 0 && (
          <DialogBody className="space-y-2 text-sm text-slate-700">
            <p>{t("workspace.analysis.dashboards.stale_overwrite_removes")}</p>
            <ul className="list-disc space-y-1 pl-5">
              {removedItemNames.map((itemName, index) => (
                // Two blocks can share a label ("Text"), so the position keeps the keys apart.
                <li key={`${index}-${itemName}`}>{itemName}</li>
              ))}
            </ul>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onReload} disabled={isSaving}>
            {t("workspace.analysis.dashboards.stale_reload")}
          </Button>
          <Button onClick={onSaveAnyway} loading={isSaving}>
            {t("workspace.analysis.dashboards.stale_save_anyway")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
