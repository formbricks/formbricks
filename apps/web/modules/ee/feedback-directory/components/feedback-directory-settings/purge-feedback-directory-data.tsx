"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { purgeFeedbackDirectoryDataAction } from "@/modules/ee/feedback-directory/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface PurgeFeedbackDirectoryDataProps {
  directoryId: string;
  onPurge: () => void;
  isOwnerOrManager: boolean;
}

export const PurgeFeedbackDirectoryData = ({
  directoryId,
  onPurge,
  isOwnerOrManager,
}: Readonly<PurgeFeedbackDirectoryDataProps>) => {
  const { t } = useTranslation();
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const router = useRouter();

  const handlePurge = async () => {
    setIsPurging(true);

    const response = await purgeFeedbackDirectoryDataAction({ directoryId });

    if (response?.data) {
      toast.success(t("workspace.settings.feedback_directories.data_purged_successfully"));
      onPurge?.();
      router.refresh();
    } else {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setIsPurgeDialogOpen(false);
    setIsPurging(false);
  };

  return (
    <>
      <div className="flex flex-row items-baseline gap-x-2">
        <TooltipRenderer
          shouldRender={!isOwnerOrManager}
          tooltipContent={t("workspace.settings.feedback_directories.purge_not_allowed")}
          className="w-auto">
          <Button
            variant="destructive"
            type="button"
            className="w-auto"
            disabled={!isOwnerOrManager}
            onClick={() => setIsPurgeDialogOpen(true)}>
            {t("workspace.settings.feedback_directories.purge_all_data")}
          </Button>
        </TooltipRenderer>
      </div>

      {isPurgeDialogOpen && (
        <Dialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
          <DialogContent width="narrow" hideCloseButton={true} disableCloseOnOutsideClick={true}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CircleAlert className="size-4 text-red-600" />
                <DialogTitle>{t("workspace.settings.feedback_directories.purge_all_data")}</DialogTitle>
              </div>
            </DialogHeader>

            <DialogBody>
              <p className="text-sm text-slate-700">
                {t("workspace.settings.feedback_directories.purge_all_data_warning")}
              </p>
            </DialogBody>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsPurgeDialogOpen(false)} disabled={isPurging}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handlePurge} loading={isPurging}>
                {t("workspace.settings.feedback_directories.purge_all_data")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
